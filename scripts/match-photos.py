#!/usr/bin/env python3

"""
Post-event face matching pipeline using InsightFace (buffalo_l / ArcFace R50).

Downloads attendee selfies from Firebase Storage, processes photographer photos
with InsightFace, matches faces using cosine similarity, and writes results
back to Firestore for admin review.

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS=path/to/des-rangila-firebase-adminsdk.json
    python scripts/match-photos.py ~/path/to/photographer-photos/

Thresholds:
    > 0.3  → auto-approved (high confidence, linked automatically)
    0.2–0.3 → pending (needs admin review)
    < 0.2  → no match
"""

import sys
import os
import time
import argparse
import tempfile
from pathlib import Path
from datetime import datetime

import cv2
import numpy as np

# Suppress unnecessary warnings from onnxruntime
os.environ["ORT_LOG_LEVEL"] = "3"

try:
    import insightface
    from insightface.app import FaceAnalysis
except ImportError:
    print("ERROR: insightface not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
except ImportError:
    print("ERROR: firebase-admin not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)


# ── Constants ────────────────────────────────────────────────────────────────
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
AUTO_APPROVE_THRESHOLD = 0.35  # Cosine similarity above this → auto-approved
REVIEW_THRESHOLD = 0.2         # Between this and AUTO_APPROVE → pending review
STORAGE_BUCKET = None          # Set from Firebase config


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors (with explicit normalization)."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def capitalize(s: str) -> str:
    return s[0].upper() + s[1:] if s else s


def get_image_files(dir_path: str) -> list[str]:
    """Get image files from a directory, sorted alphabetically."""
    p = Path(dir_path)
    if not p.exists():
        print(f"  ERROR: Directory not found: {dir_path}")
        sys.exit(1)
    return sorted(
        f.name for f in p.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS
    )


def init_firebase():
    """Initialize Firebase Admin SDK and return (db, bucket) clients."""
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        print("ERROR: GOOGLE_APPLICATION_CREDENTIALS environment variable not set.")
        print("  export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json")
        sys.exit(1)

    if not os.path.exists(cred_path):
        print(f"ERROR: Credentials file not found: {cred_path}")
        sys.exit(1)

    cred = credentials.Certificate(cred_path)

    # Read the project ID and storage bucket from the service account
    import json
    with open(cred_path) as f:
        sa_data = json.load(f)
    project_id = sa_data.get("project_id", "")

    app = firebase_admin.initialize_app(cred, {
        "storageBucket": f"{project_id}.firebasestorage.app",
    })

    db = firestore.client()
    bucket = storage.bucket()

    return db, bucket


def download_selfies(bucket, temp_dir: str) -> dict[str, str]:
    """Download all selfie images from Firebase Storage.
    Returns dict of {attendeeId: local_file_path}."""
    print("Downloading selfies from Firebase Storage...")

    blobs = list(bucket.list_blobs(prefix="selfies/"))
    selfie_blobs = [b for b in blobs if b.name != "selfies/" and any(
        b.name.lower().endswith(ext) for ext in IMAGE_EXTENSIONS
    )]

    if not selfie_blobs:
        print("  WARNING: No selfie images found in selfies/ folder.")
        return {}

    selfie_paths = {}
    for blob in selfie_blobs:
        # Extract attendee ID from filename (selfies/{attendeeId}.jpg)
        filename = os.path.basename(blob.name)
        attendee_id = Path(filename).stem
        local_path = os.path.join(temp_dir, filename)

        blob.download_to_filename(local_path)
        selfie_paths[attendee_id] = local_path

    print(f"  Downloaded {len(selfie_paths)} selfies ✓\n")
    return selfie_paths


def get_attendee_names(db, attendee_ids: list[str]) -> dict[str, str]:
    """Fetch attendee names from Firestore."""
    names = {}
    for aid in attendee_ids:
        doc = db.collection("attendees").document(aid).get()
        if doc.exists:
            data = doc.to_dict()
            names[aid] = data.get("name", aid)
        else:
            names[aid] = aid
    return names


def upload_photographer_photo(bucket, local_path: str, filename: str) -> str:
    """Upload a photographer photo to Firebase Storage and return the public URL."""
    storage_path = f"photos/photographer/{filename}"
    blob = bucket.blob(storage_path)
    blob.upload_from_filename(local_path, content_type="image/jpeg")
    blob.make_public()
    return blob.public_url


def main():
    parser = argparse.ArgumentParser(
        description="Post-event face matching using InsightFace + Firebase"
    )
    parser.add_argument(
        "photographer_dir",
        help="Path to folder containing photographer photos"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run matching but don't write to Firestore or upload photos"
    )
    args = parser.parse_args()

    photographer_dir = os.path.expanduser(args.photographer_dir)

    print("InsightFace Post-Event Matching Pipeline")
    print("=" * 60)
    print(f"  Photographer photos: {photographer_dir}")
    print(f"  Auto-approve threshold: {AUTO_APPROVE_THRESHOLD}")
    print(f"  Review threshold: {REVIEW_THRESHOLD}")
    print(f"  Dry run: {args.dry_run}")
    print()

    # ── Initialize Firebase ──────────────────────────────────────────────
    print("Connecting to Firebase...")
    db, bucket = init_firebase()
    print("  Firebase connected ✓\n")

    # ── Download selfies ─────────────────────────────────────────────────
    temp_dir = tempfile.mkdtemp(prefix="des-rangila-selfies-")
    print(f"  Temp directory: {temp_dir}")
    selfie_paths = download_selfies(bucket, temp_dir)

    if not selfie_paths:
        print("ERROR: No selfies found. Cannot proceed with matching.")
        sys.exit(1)

    # ── Get attendee names ───────────────────────────────────────────────
    print("Fetching attendee names from Firestore...")
    attendee_names = get_attendee_names(db, list(selfie_paths.keys()))
    print(f"  {len(attendee_names)} attendees loaded ✓\n")

    # ── Initialize InsightFace ───────────────────────────────────────────
    print("Initializing InsightFace (buffalo_l model)...")
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("  Model loaded ✓\n")

    # ── Process selfies → extract embeddings ─────────────────────────────
    print("=== Processing Selfies ===")
    selfie_embeddings = []  # {attendee_id, name, embedding}

    for attendee_id, selfie_path in selfie_paths.items():
        name = attendee_names.get(attendee_id, attendee_id)
        img = cv2.imread(selfie_path)

        if img is None:
            print(f"  {attendee_id:<30} → ⚠ could not read image, skipping")
            continue

        faces = app.get(img)

        if not faces:
            print(f"  {attendee_id:<30} → ⚠ no face detected, skipping")
            continue

        # Use highest detection confidence if multiple faces
        best_face = max(faces, key=lambda f: f.det_score)
        print(f"  {name:<30} → embedding extracted (512-dim) ✓")

        selfie_embeddings.append({
            "attendee_id": attendee_id,
            "name": name,
            "embedding": best_face.embedding,
        })

    if not selfie_embeddings:
        print("\nERROR: No valid face embeddings extracted from selfies.")
        sys.exit(1)

    print(f"\n  {len(selfie_embeddings)} attendee embeddings ready\n")

    # ── Process photographer photos ──────────────────────────────────────
    print("=== Processing Photographer Photos ===")
    photo_files = get_image_files(photographer_dir)

    if not photo_files:
        print("  ERROR: No image files found in photographer directory.")
        sys.exit(1)

    total_photos = 0
    total_faces = 0
    total_auto_approved = 0
    total_pending = 0
    total_unmatched = 0
    processing_times = []
    match_results = []  # Collect all matches for batch write

    for file in photo_files:
        filepath = os.path.join(photographer_dir, file)
        total_photos += 1

        img = cv2.imread(filepath)
        if img is None:
            print(f"  {file} → ⚠ could not read image, skipping")
            continue

        t0 = time.time()
        faces = app.get(img)
        elapsed = time.time() - t0
        processing_times.append(elapsed)

        face_count = len(faces)
        total_faces += face_count

        print(f"  {file} → {face_count} face{'s' if face_count != 1 else ''} detected")

        if face_count == 0:
            continue

        for i, face in enumerate(faces):
            best_attendee = None
            best_sim = -1.0

            for selfie in selfie_embeddings:
                sim = cosine_similarity(face.embedding, selfie["embedding"])
                if sim > best_sim:
                    best_sim = sim
                    best_attendee = selfie

            if best_sim >= AUTO_APPROVE_THRESHOLD:
                status = "auto-approved"
                total_auto_approved += 1
                print(f"    Face {i + 1}: {best_attendee['name']} "
                      f"(similarity: {best_sim:.3f}) → auto-approved ✓")
            elif best_sim >= REVIEW_THRESHOLD:
                status = "pending"
                total_pending += 1
                print(f"    Face {i + 1}: {best_attendee['name']} "
                      f"(similarity: {best_sim:.3f}) → needs review ⚠")
            else:
                total_unmatched += 1
                print(f"    Face {i + 1}: No match "
                      f"(best: {best_attendee['name'] if best_attendee else 'N/A'} "
                      f"at {best_sim:.3f}) ✗")
                continue

            # Get bounding box from face detection
            bbox = face.bbox.astype(int)
            bounding_box = {
                "x": int(bbox[0]),
                "y": int(bbox[1]),
                "width": int(bbox[2] - bbox[0]),
                "height": int(bbox[3] - bbox[1]),
            }

            match_results.append({
                "file": file,
                "filepath": filepath,
                "attendee_id": best_attendee["attendee_id"],
                "attendee_name": best_attendee["name"],
                "confidence": round(best_sim, 4),
                "status": status,
                "bounding_box": bounding_box,
            })

    # ── Upload photos & write to Firestore ───────────────────────────────
    if not args.dry_run and match_results:
        print(f"\n=== Uploading Photos & Writing Results ===")

        # Track which photos have been uploaded (avoid duplicates)
        uploaded_photos = {}  # filename → public URL

        for match in match_results:
            # Upload photographer photo if not already uploaded
            if match["file"] not in uploaded_photos:
                print(f"  Uploading {match['file']}...")
                photo_url = upload_photographer_photo(
                    bucket, match["filepath"], match["file"]
                )
                uploaded_photos[match["file"]] = photo_url
            else:
                photo_url = uploaded_photos[match["file"]]

            # Write match to Firestore
            doc_ref = db.collection("face_match_queue").document()
            doc_ref.set({
                "id": doc_ref.id,
                "photoUrl": photo_url,
                "attendeeId": match["attendee_id"],
                "attendeeName": match["attendee_name"],
                "confidence": match["confidence"],
                "status": match["status"],
                "boundingBox": match["bounding_box"],
                "createdAt": firestore.SERVER_TIMESTAMP,
                "reviewedAt": None,
                "reviewedBy": None,
            })

        print(f"  {len(uploaded_photos)} photos uploaded ✓")
        print(f"  {len(match_results)} match records written to Firestore ✓")

    elif args.dry_run:
        print(f"\n  [DRY RUN] Would upload {len(set(m['file'] for m in match_results))} photos")
        print(f"  [DRY RUN] Would write {len(match_results)} match records to Firestore")

    # ── Summary ──────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("=== Summary ===")
    print(f"  Selfies processed: {len(selfie_embeddings)}")
    print(f"  Photographer photos: {total_photos}")
    print(f"  Total faces detected: {total_faces}")
    print(f"  Auto-approved (>{AUTO_APPROVE_THRESHOLD}): {total_auto_approved}")
    print(f"  Needs review ({REVIEW_THRESHOLD}–{AUTO_APPROVE_THRESHOLD}): {total_pending}")
    print(f"  Unmatched (<{REVIEW_THRESHOLD}): {total_unmatched}")
    print()

    if processing_times:
        avg_ms = sum(processing_times) / len(processing_times) * 1000
        total_s = sum(processing_times)
        print(f"  Avg processing time per photo: {avg_ms:.0f}ms")
        print(f"  Total processing time: {total_s:.1f}s")
        est_500 = avg_ms * 500 / 1000
        print(f"  Estimated time for 500 photos: {est_500:.0f}s ({est_500 / 60:.1f}min)")
        print()

    # Clean up temp directory
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)
    print(f"  Cleaned up temp directory ✓")
    print()


if __name__ == "__main__":
    main()
