#!/usr/bin/env python3

"""
Continuous face-matching daemon for Des Rangila photo booth.

Polls Firestore every 30 seconds for new booth photos, runs InsightFace
face detection/recognition against attendee selfies, and writes match
results back to Firestore. Auto-approved matches (>0.3 cosine similarity)
are immediately visible on attendee passport pages.

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
    python scripts/match-daemon.py

Designed to run as a Docker container on EC2 during the event.
"""

import sys
import os
import time
import signal
import logging
import tempfile
from pathlib import Path
from datetime import datetime

import cv2
import numpy as np
import requests as http_requests

# Suppress onnxruntime warnings
os.environ["ORT_LOG_LEVEL"] = "3"

try:
    from insightface.app import FaceAnalysis
except ImportError:
    print("ERROR: insightface not installed. Run: pip install -r requirements-daemon.txt")
    sys.exit(1)

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
except ImportError:
    print("ERROR: firebase-admin not installed. Run: pip install -r requirements-daemon.txt")
    sys.exit(1)


# ── Configuration ───────────────────────────────────────────────────────────
AUTO_APPROVE_THRESHOLD = 0.3
REVIEW_THRESHOLD = 0.2
POLL_INTERVAL = 30          # seconds between polls
SELFIE_REFRESH_INTERVAL = 300  # seconds between selfie cache refreshes
MAX_RETRY_ATTEMPTS = 3
BATCH_SIZE = 50             # max photos per poll cycle
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("match-daemon")

# ── Graceful shutdown ───────────────────────────────────────────────────────
shutdown_requested = False

def handle_signal(signum, frame):
    global shutdown_requested
    logger.info(f"Received signal {signum}, shutting down after current photo...")
    shutdown_requested = True

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


# ── Utilities ───────────────────────────────────────────────────────────────

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def download_image_from_url(url: str) -> np.ndarray | None:
    """Download an image from a public URL and return as cv2 array."""
    try:
        resp = http_requests.get(url, timeout=30)
        resp.raise_for_status()
        arr = np.frombuffer(resp.content, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.warning(f"Failed to download image {url}: {e}")
        return None


# ── Firebase ────────────────────────────────────────────────────────────────

def init_firebase():
    """Initialize Firebase Admin SDK. Returns (db, bucket)."""
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        logger.error("GOOGLE_APPLICATION_CREDENTIALS environment variable not set.")
        sys.exit(1)

    if not os.path.exists(cred_path):
        logger.error(f"Credentials file not found: {cred_path}")
        sys.exit(1)

    cred = credentials.Certificate(cred_path)

    import json
    with open(cred_path) as f:
        sa_data = json.load(f)
    project_id = sa_data.get("project_id", "")

    firebase_admin.initialize_app(cred, {
        "storageBucket": f"{project_id}.firebasestorage.app",
    })

    db = firestore.client()
    bucket = storage.bucket()
    logger.info(f"Firebase connected (project: {project_id})")
    return db, bucket


# ── Selfie Cache ────────────────────────────────────────────────────────────

class SelfieCache:
    """Caches attendee selfie embeddings, refreshing periodically for new check-ins."""

    def __init__(self):
        self.embeddings = {}  # attendee_id -> {"name": str, "embedding": ndarray}
        self.last_refresh = 0
        self.temp_dir = tempfile.mkdtemp(prefix="des-rangila-daemon-selfies-")

    def needs_refresh(self) -> bool:
        return time.time() - self.last_refresh > SELFIE_REFRESH_INTERVAL

    def load(self, bucket, face_app, db):
        """Initial load of all selfie embeddings."""
        logger.info("Loading selfie embeddings...")
        self._refresh(bucket, face_app, db)

    def refresh_if_needed(self, bucket, face_app, db):
        """Refresh cache if interval has elapsed (only processes new attendees)."""
        if self.needs_refresh():
            logger.info("Refreshing selfie cache for new attendees...")
            self._refresh(bucket, face_app, db)

    def _refresh(self, bucket, face_app, db):
        """Download and embed selfies, skipping already-cached attendees."""
        blobs = list(bucket.list_blobs(prefix="selfies/"))
        selfie_blobs = [
            b for b in blobs
            if b.name != "selfies/" and any(
                b.name.lower().endswith(ext) for ext in IMAGE_EXTENSIONS
            )
        ]

        if not selfie_blobs:
            logger.warning("No selfie images found in selfies/ folder")
            self.last_refresh = time.time()
            return

        new_count = 0
        for blob in selfie_blobs:
            filename = os.path.basename(blob.name)
            attendee_id = Path(filename).stem

            if attendee_id in self.embeddings:
                continue  # already cached

            local_path = os.path.join(self.temp_dir, filename)
            try:
                blob.download_to_filename(local_path)
            except Exception as e:
                logger.warning(f"Failed to download selfie for {attendee_id}: {e}")
                continue

            img = cv2.imread(local_path)
            if img is None:
                logger.warning(f"Could not read selfie image for {attendee_id}")
                continue

            faces = face_app.get(img)
            if not faces:
                logger.warning(f"No face detected in selfie for {attendee_id}")
                continue

            best_face = max(faces, key=lambda f: f.det_score)

            # Fetch attendee name
            doc = db.collection("attendees").document(attendee_id).get()
            name = doc.to_dict().get("name", attendee_id) if doc.exists else attendee_id

            self.embeddings[attendee_id] = {
                "name": name,
                "embedding": best_face.embedding,
            }
            new_count += 1

        self.last_refresh = time.time()
        if new_count > 0:
            logger.info(f"Cached {new_count} new selfie embeddings (total: {len(self.embeddings)})")
        else:
            logger.info(f"Selfie cache up to date ({len(self.embeddings)} attendees)")

    def cleanup(self):
        """Remove temp directory."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)


# ── Photo Processing ────────────────────────────────────────────────────────

def fetch_unmatched_photos(db, limit=BATCH_SIZE):
    """Fetch booth photos that haven't been face-match processed."""
    query = (
        db.collection("photos")
        .where("photoType", "==", "booth")
        .order_by("uploadedAt", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )

    docs = list(query.stream())
    unmatched = []
    for doc in docs:
        data = doc.to_dict()
        if data.get("faceMatchProcessed"):
            continue
        attempts = data.get("faceMatchAttempts", 0)
        if attempts >= MAX_RETRY_ATTEMPTS:
            continue
        unmatched.append(doc)

    return unmatched


def process_photo(photo_doc, db, face_app, selfie_cache):
    """Process a single booth photo: detect faces, match against selfies, write results."""
    photo_id = photo_doc.id
    data = photo_doc.to_dict()
    individual_urls = data.get("individualPhotos", [])

    if not individual_urls:
        logger.warning(f"Photo {photo_id} has no individualPhotos, marking processed")
        db.collection("photos").document(photo_id).update({
            "faceMatchProcessed": True,
            "faceMatchCount": 0,
        })
        return

    logger.info(f"Processing photo {photo_id} ({len(individual_urls)} frames)")

    all_matches = []  # collect all matches across all frames
    matched_attendee_ids = set()

    for frame_idx, url in enumerate(individual_urls):
        img = download_image_from_url(url)
        if img is None:
            logger.warning(f"  Frame {frame_idx}: could not download, skipping")
            continue

        faces = face_app.get(img)
        if not faces:
            logger.info(f"  Frame {frame_idx}: no faces detected")
            continue

        logger.info(f"  Frame {frame_idx}: {len(faces)} face(s) detected")

        for face in faces:
            best_attendee = None
            best_sim = -1.0

            for attendee_id, selfie_data in selfie_cache.embeddings.items():
                sim = cosine_similarity(face.embedding, selfie_data["embedding"])
                if sim > best_sim:
                    best_sim = sim
                    best_attendee = (attendee_id, selfie_data["name"])

            if best_sim < REVIEW_THRESHOLD:
                logger.info(f"    No match (best: {best_attendee[1] if best_attendee else 'N/A'} at {best_sim:.3f})")
                continue

            attendee_id, attendee_name = best_attendee
            bbox = face.bbox.astype(int)
            bounding_box = {
                "x": int(bbox[0]),
                "y": int(bbox[1]),
                "width": int(bbox[2] - bbox[0]),
                "height": int(bbox[3] - bbox[1]),
            }

            if best_sim >= AUTO_APPROVE_THRESHOLD:
                status = "auto-approved"
                matched_attendee_ids.add(attendee_id)
                logger.info(f"    → {attendee_name} (sim: {best_sim:.3f}) auto-approved ✓")
            else:
                status = "pending"
                logger.info(f"    → {attendee_name} (sim: {best_sim:.3f}) needs review ⚠")

            all_matches.append({
                "attendee_id": attendee_id,
                "attendee_name": attendee_name,
                "confidence": round(best_sim, 4),
                "status": status,
                "bounding_box": bounding_box,
                "frame_url": url,
            })

    # Write results to Firestore
    photo_ref = db.collection("photos").document(photo_id)
    has_pending = any(m["status"] == "pending" for m in all_matches)

    # Write match queue entries
    for match in all_matches:
        doc_ref = db.collection("face_match_queue").document()
        doc_ref.set({
            "id": doc_ref.id,
            "photoId": photo_id,
            "photoUrl": match["frame_url"],
            "attendeeId": match["attendee_id"],
            "attendeeName": match["attendee_name"],
            "confidence": match["confidence"],
            "status": match["status"],
            "boundingBox": match["bounding_box"],
            "createdAt": firestore.SERVER_TIMESTAMP,
            "reviewedAt": None,
            "reviewedBy": None,
        })

    # Update photo document
    update_data = {
        "faceMatchProcessed": True,
        "faceMatchCount": len(all_matches),
    }

    # Auto-approved matches: add attendee IDs so they appear on /me immediately
    if matched_attendee_ids:
        update_data["attendeeIds"] = firestore.ArrayUnion(list(matched_attendee_ids))

    if has_pending:
        update_data["needsReview"] = True

    photo_ref.update(update_data)
    logger.info(f"  Done: {len(all_matches)} matches ({len(matched_attendee_ids)} auto-approved)")


def process_backlog(db, face_app, selfie_cache):
    """Process all unmatched booth photos (startup backlog)."""
    logger.info("=== Processing backlog ===")
    total = 0

    while not shutdown_requested:
        # Fetch in batches — can't use limit=None with order_by efficiently
        query = (
            db.collection("photos")
            .where("photoType", "==", "booth")
            .order_by("uploadedAt", direction=firestore.Query.DESCENDING)
            .limit(200)
        )
        docs = list(query.stream())

        unmatched = [
            doc for doc in docs
            if not doc.to_dict().get("faceMatchProcessed")
            and doc.to_dict().get("faceMatchAttempts", 0) < MAX_RETRY_ATTEMPTS
        ]

        if not unmatched:
            break

        for doc in unmatched:
            if shutdown_requested:
                break
            try:
                process_photo(doc, db, face_app, selfie_cache)
                total += 1
            except Exception as e:
                photo_id = doc.id
                logger.error(f"Failed to process photo {photo_id}: {e}")
                try:
                    db.collection("photos").document(photo_id).update({
                        "faceMatchError": str(e)[:500],
                        "faceMatchAttempts": firestore.Increment(1),
                    })
                except Exception:
                    pass

    logger.info(f"Backlog complete: processed {total} photos")


def poll_loop(db, bucket, face_app, selfie_cache):
    """Main polling loop — runs every POLL_INTERVAL seconds."""
    logger.info(f"=== Starting poll loop (every {POLL_INTERVAL}s) ===")

    while not shutdown_requested:
        try:
            # Refresh selfie cache if needed (new attendees checking in)
            selfie_cache.refresh_if_needed(bucket, face_app, db)

            # Fetch unmatched photos
            unmatched = fetch_unmatched_photos(db)

            if unmatched:
                logger.info(f"Found {len(unmatched)} unmatched photo(s)")
                for doc in unmatched:
                    if shutdown_requested:
                        break
                    try:
                        process_photo(doc, db, face_app, selfie_cache)
                    except Exception as e:
                        photo_id = doc.id
                        logger.error(f"Failed to process photo {photo_id}: {e}")
                        try:
                            db.collection("photos").document(photo_id).update({
                                "faceMatchError": str(e)[:500],
                                "faceMatchAttempts": firestore.Increment(1),
                            })
                        except Exception:
                            pass

        except Exception as e:
            logger.error(f"Poll cycle error: {e}")

        # Sleep in small increments to allow graceful shutdown
        for _ in range(POLL_INTERVAL):
            if shutdown_requested:
                break
            time.sleep(1)


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    logger.info("Des Rangila Face-Matching Daemon")
    logger.info("=" * 50)
    logger.info(f"Auto-approve threshold: {AUTO_APPROVE_THRESHOLD}")
    logger.info(f"Review threshold: {REVIEW_THRESHOLD}")
    logger.info(f"Poll interval: {POLL_INTERVAL}s")
    logger.info(f"Selfie refresh interval: {SELFIE_REFRESH_INTERVAL}s")

    # Initialize Firebase
    db, bucket = init_firebase()

    # Initialize InsightFace
    logger.info("Loading InsightFace model (buffalo_l)...")
    face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    logger.info("Model loaded ✓")

    # Load selfie embeddings
    selfie_cache = SelfieCache()
    selfie_cache.load(bucket, face_app, db)

    if not selfie_cache.embeddings:
        logger.warning("No selfie embeddings found — will retry on refresh")

    try:
        # Process any backlog first
        process_backlog(db, face_app, selfie_cache)

        # Enter main polling loop
        if not shutdown_requested:
            poll_loop(db, bucket, face_app, selfie_cache)

    finally:
        selfie_cache.cleanup()
        logger.info("Daemon stopped.")


if __name__ == "__main__":
    main()
