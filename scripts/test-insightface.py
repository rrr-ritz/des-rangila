#!/usr/bin/env python3

"""
Standalone InsightFace/ArcFace face recognition test script.

Tests the InsightFace pipeline using local image files — same test setup
as the face-api.js test for direct comparison.

Usage:
    python scripts/test-insightface.py <ground-truth-folder> <photographer-dump-folder> [labels-file]

Example:
    python scripts/test-insightface.py \
        ~/Downloads/facial-recognition-test/ground-truth \
        ~/Downloads/facial-recognition-test/photographer-dump \
        scripts/test-labels.txt

Ground truth folder: each image filename (without extension) is the person's
name (e.g., ritvik.png -> "Ritvik"). One face per image.

Photographer dump folder: event photos with multiple faces per image.

Labels file (optional): ground truth labels for precision/recall calculation.
Each line: filename:name1,name2  (empty after colon = no known people).
"""

import sys
import os
import time
from pathlib import Path
from collections import defaultdict

import cv2
import numpy as np

# Suppress unnecessary warnings from onnxruntime
os.environ["ORT_LOG_LEVEL"] = "3"

try:
    import insightface
    from insightface.app import FaceAnalysis
except ImportError:
    print("ERROR: insightface not installed. Run: pip install insightface onnxruntime opencv-python numpy")
    sys.exit(1)


# ── Constants ────────────────────────────────────────────────────────────────
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
THRESHOLDS = [0.3, 0.4]  # Cosine similarity thresholds to test


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


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors (with explicit normalization
    in case embeddings aren't pre-normalized)."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def load_labels(labels_path: str) -> dict[str, set[str]]:
    """Load ground truth labels from file.
    Format: filename:name1,name2  (case-insensitive names, empty = no people)."""
    labels = {}
    with open(labels_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" not in line:
                continue
            filename, names_str = line.split(":", 1)
            filename = filename.strip()
            names = {n.strip().lower() for n in names_str.split(",") if n.strip()}
            labels[filename.lower()] = names
    return labels


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print("Usage: python scripts/test-insightface.py <ground-truth-folder> <photographer-dump-folder> [labels-file]")
        sys.exit(1)

    ground_truth_dir = os.path.expanduser(args[0])
    photographer_dir = os.path.expanduser(args[1])
    labels_path = os.path.expanduser(args[2]) if len(args) > 2 else None

    print("InsightFace Recognition Test")
    print("=" * 60)
    print(f"  Ground truth:     {ground_truth_dir}")
    print(f"  Photographer:     {photographer_dir}")
    print(f"  Labels file:      {labels_path or '(none — skipping precision/recall)'}")
    print(f"  Thresholds:       {', '.join(str(t) for t in THRESHOLDS)}")
    print()

    # ── Initialize InsightFace ──────────────────────────────────────────
    print("Initializing InsightFace (buffalo_l model)...")
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("  Model loaded ✓\n")

    # ── Load labels (if provided) ───────────────────────────────────────
    labels = None
    if labels_path:
        try:
            labels = load_labels(labels_path)
            print(f"  Labels loaded: {len(labels)} photos\n")
        except FileNotFoundError:
            print(f"  WARNING: Labels file not found: {labels_path}")
            print("  Skipping precision/recall calculation.\n")
            labels = None

    # ── Step 1: Process ground truth images ─────────────────────────────
    print("=== Ground Truth Loaded ===")
    gt_files = get_image_files(ground_truth_dir)

    if not gt_files:
        print("  ERROR: No image files found in ground truth directory.")
        sys.exit(1)

    ground_truth: list[dict] = []  # {name, embedding}

    for file in gt_files:
        name = capitalize(Path(file).stem)
        filepath = os.path.join(ground_truth_dir, file)

        img = cv2.imread(filepath)
        if img is None:
            print(f"  {file:<30} → ⚠ could not read image, skipping")
            continue

        faces = app.get(img)

        if not faces:
            print(f"  {file:<30} → ⚠ no face detected, skipping")
            continue

        # Use highest detection confidence if multiple faces
        best_face = max(faces, key=lambda f: f.det_score)

        if len(faces) > 1:
            print(f"  {file:<30} → {len(faces)} faces found, using highest confidence "
                  f"(score: {best_face.det_score:.2f}) → embedding extracted (512-dim) ✓")
        else:
            print(f"  {file:<30} → embedding extracted (512-dim) ✓")

        ground_truth.append({"name": name, "embedding": best_face.embedding})

    if not ground_truth:
        print("\n  ERROR: No valid face embeddings extracted from ground truth.")
        sys.exit(1)

    print(f"\n  {len(ground_truth)} people registered\n")

    # ── Step 2: Process photographer photos (for each threshold) ────────
    photo_files = get_image_files(photographer_dir)

    if not photo_files:
        print("  ERROR: No image files found in photographer directory.")
        sys.exit(1)

    for threshold in THRESHOLDS:
        print(f"{'=' * 60}")
        print(f"=== Processing Photographer Photos (threshold={threshold}) ===")
        print(f"{'=' * 60}")

        total_photos = 0
        total_faces = 0
        total_matched = 0
        total_unmatched = 0
        per_person: dict[str, set[str]] = defaultdict(set)
        processing_times: list[float] = []

        # For precision/recall
        true_positives = 0
        false_positives = 0
        false_negatives = 0

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
                # If labels say people should be here, they're all false negatives
                if labels:
                    label_key = file.lower()
                    if label_key in labels:
                        false_negatives += len(labels[label_key])
                continue

            matched_names_in_photo: set[str] = set()

            for i, face in enumerate(faces):
                best_name = None
                best_sim = -1.0

                for gt in ground_truth:
                    sim = cosine_similarity(face.embedding, gt["embedding"])
                    if sim > best_sim:
                        best_sim = sim
                        best_name = gt["name"]

                if best_sim >= threshold:
                    total_matched += 1
                    per_person[best_name].add(file)
                    matched_names_in_photo.add(best_name.lower())
                    print(f"    Face {i + 1}: {best_name} (similarity: {best_sim:.2f}) ✓")
                else:
                    total_unmatched += 1
                    print(f"    Face {i + 1}: No match (best: {best_name} at {best_sim:.2f}) ✗")

            # Precision/recall accounting
            if labels:
                label_key = file.lower()
                if label_key in labels:
                    actual_names = labels[label_key]
                    for matched in matched_names_in_photo:
                        if matched in actual_names:
                            true_positives += 1
                        else:
                            false_positives += 1
                    for actual in actual_names:
                        if actual not in matched_names_in_photo:
                            false_negatives += 1

        # ── Summary ─────────────────────────────────────────────────────
        print()
        print(f"=== Summary (threshold={threshold}) ===")
        print(f"  Photos processed: {total_photos}")
        print(f"  Total faces found: {total_faces}")
        print(f"  Matched: {total_matched}")
        print(f"  Unmatched: {total_unmatched}")
        match_rate = round(total_matched / total_faces * 100) if total_faces > 0 else 0
        print(f"  Match rate: {match_rate}%")
        print()
        print("  Per-person breakdown:")

        all_gt_names = sorted(per_person.keys(), key=lambda n: -len(per_person[n]))
        # Include people with 0 matches
        for gt in ground_truth:
            if gt["name"] not in per_person:
                all_gt_names.append(gt["name"])

        max_name_len = max(len(n) for n in all_gt_names) if all_gt_names else 0
        for name in all_gt_names:
            count = len(per_person.get(name, set()))
            print(f"    {name:<{max_name_len + 1}} found in {count} photo{'s' if count != 1 else ''}")

        # Precision / Recall / F1
        if labels:
            precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
            recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
            print()
            print(f"  Precision: {precision:.1%} ({true_positives}/{true_positives + false_positives})")
            print(f"  Recall:    {recall:.1%} ({true_positives}/{true_positives + false_negatives})")
            print(f"  F1 Score:  {f1:.1%}")
            print(f"  (TP={true_positives}, FP={false_positives}, FN={false_negatives})")

        # Timing
        if processing_times:
            avg_ms = sum(processing_times) / len(processing_times) * 1000
            total_s = sum(processing_times)
            print()
            print(f"  Avg processing time per photo: {avg_ms:.0f}ms")
            print(f"  Total processing time: {total_s:.1f}s")
            est_500 = avg_ms * 500 / 1000
            print(f"  Estimated time for 500 photos: {est_500:.0f}s ({est_500 / 60:.1f}min)")

        print()

    # ── Comparison reminder ─────────────────────────────────────────────
    print("=== Comparison with face-api.js ===")
    print("  face-api.js results: 82.5% F1, 83.9% precision, 81.3% recall")
    print("  InsightFace results: see above per threshold")
    print()


if __name__ == "__main__":
    main()
