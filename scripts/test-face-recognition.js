#!/usr/bin/env node

/**
 * Standalone face recognition test script.
 *
 * Tests the face-api.js pipeline entirely offline using local image files.
 * No server, no Firestore, no UI — just face-api.js processing local folders.
 *
 * Usage:
 *   node scripts/test-face-recognition.js <ground-truth-folder> <photographer-dump-folder>
 *
 * Example:
 *   node scripts/test-face-recognition.js \
 *     ~/Downloads/facial-recognition-test/ground-truth \
 *     ~/Downloads/facial-recognition-test/photographer-dump
 *
 * Ground truth folder: each image filename (without extension) is the person's
 * name (e.g., ritvik.png → "Ritvik"). One face per image.
 *
 * Photographer dump folder: event photos with multiple faces per image.
 * The script detects ALL faces and matches them against ground truth.
 *
 * Requires: canvas, @tensorflow/tfjs, @vladmandic/face-api (all in devDeps)
 */

// ── Module alias: redirect @tensorflow/tfjs-node → @tensorflow/tfjs ────────
// face-api's Node entry point requires tfjs-node (native C++).
// We alias it to pure-JS tfjs so no native compilation is needed.
const Module = require("module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "@tensorflow/tfjs-node") {
    return originalResolve.call(
      this,
      "@tensorflow/tfjs",
      parent,
      isMain,
      options
    );
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const canvas = require("canvas");
const faceapi = require("@vladmandic/face-api");
const path = require("path");
const fs = require("fs");

// ── Monkey-patch face-api for Node.js (canvas polyfill) ────────────────────
faceapi.env.monkeyPatch({
  Canvas: canvas.Canvas,
  Image: canvas.Image,
  ImageData: canvas.ImageData,
  createCanvasElement: () => canvas.createCanvas(1, 1),
  createImageElement: () => new canvas.Image(),
});

// ── Constants ──────────────────────────────────────────────────────────────
const MATCH_THRESHOLD = 0.6;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Load an image file into a canvas element that face-api can process. */
async function loadImageToCanvas(filePath) {
  const img = await canvas.loadImage(filePath);
  const c = canvas.createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return c;
}

/** Get image files from a directory, sorted alphabetically. */
function getImageFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.error(`  ERROR: Directory not found: ${dirPath}`);
    process.exit(1);
  }
  return fs
    .readdirSync(dirPath)
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort();
}

/** Euclidean distance between two descriptors. */
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Capitalize first letter. */
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Usage: node scripts/test-face-recognition.js <ground-truth-folder> <photographer-dump-folder>"
    );
    process.exit(1);
  }

  const groundTruthDir = path.resolve(args[0]);
  const photographerDir = path.resolve(args[1]);

  console.log("Face Recognition Test");
  console.log("═".repeat(60));
  console.log(`  Ground truth:     ${groundTruthDir}`);
  console.log(`  Photographer:     ${photographerDir}`);
  console.log(`  Match threshold:  ${MATCH_THRESHOLD}`);
  console.log();

  // ── Load models ──────────────────────────────────────────────────────
  const modelsDir = path.join(__dirname, "..", "public", "models");
  console.log("Loading face-api models...");
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsDir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsDir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsDir);
  console.log("  Models loaded ✓\n");

  // ── Step 1: Process ground truth images ──────────────────────────────
  console.log("=== Ground Truth Loaded ===");
  const groundTruthFiles = getImageFiles(groundTruthDir);

  if (groundTruthFiles.length === 0) {
    console.error("  ERROR: No image files found in ground truth directory.");
    process.exit(1);
  }

  const groundTruth = []; // { name, descriptor }

  for (const file of groundTruthFiles) {
    const name = capitalize(path.basename(file, path.extname(file)));
    const filePath = path.join(groundTruthDir, file);

    try {
      const c = await loadImageToCanvas(filePath);

      // Detect all faces — if multiple, use the largest one
      const detections = await faceapi
        .detectAllFaces(c)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        console.log(`  ${file.padEnd(30)} → ⚠ no face detected, skipping`);
        continue;
      }

      // Pick the largest face (by bounding box area) if multiple
      let best = detections[0];
      if (detections.length > 1) {
        for (const d of detections) {
          const area = d.detection.box.width * d.detection.box.height;
          const bestArea =
            best.detection.box.width * best.detection.box.height;
          if (area > bestArea) best = d;
        }
        console.log(
          `  ${file.padEnd(30)} → ${detections.length} faces found, using largest → descriptor extracted ✓`
        );
      } else {
        console.log(
          `  ${file.padEnd(30)} → descriptor extracted ✓`
        );
      }

      groundTruth.push({ name, descriptor: best.descriptor });
    } catch (err) {
      console.log(
        `  ${file.padEnd(30)} → ⚠ error: ${err.message}, skipping`
      );
    }
  }

  if (groundTruth.length === 0) {
    console.error(
      "\n  ERROR: No valid face descriptors extracted from ground truth."
    );
    process.exit(1);
  }

  console.log(`\n  ${groundTruth.length} people registered\n`);

  // ── Step 2: Process photographer photos ──────────────────────────────
  console.log("=== Processing Photographer Photos ===");
  const photoFiles = getImageFiles(photographerDir);

  if (photoFiles.length === 0) {
    console.error("  ERROR: No image files found in photographer directory.");
    process.exit(1);
  }

  let totalPhotos = 0;
  let totalFaces = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;
  const perPerson = {}; // name → Set of photo filenames

  for (const gt of groundTruth) {
    perPerson[gt.name] = new Set();
  }

  for (const file of photoFiles) {
    const filePath = path.join(photographerDir, file);
    totalPhotos++;

    try {
      const c = await loadImageToCanvas(filePath);

      const detections = await faceapi
        .detectAllFaces(c)
        .withFaceLandmarks()
        .withFaceDescriptors();

      console.log(
        `  ${file} → ${detections.length} face${detections.length !== 1 ? "s" : ""} detected`
      );

      if (detections.length === 0) continue;

      for (let i = 0; i < detections.length; i++) {
        const det = detections[i];
        totalFaces++;

        // Compare against all ground truth descriptors
        let bestName = null;
        let bestDistance = Infinity;

        for (const gt of groundTruth) {
          const dist = euclideanDistance(det.descriptor, gt.descriptor);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestName = gt.name;
          }
        }

        if (bestDistance < MATCH_THRESHOLD) {
          totalMatched++;
          perPerson[bestName].add(file);
          console.log(
            `    Face ${i + 1}: ${bestName} (distance: ${bestDistance.toFixed(2)}) ✓`
          );
        } else {
          totalUnmatched++;
          console.log(
            `    Face ${i + 1}: No match (best: ${bestName} at ${bestDistance.toFixed(2)}) ✗`
          );
        }
      }
    } catch (err) {
      console.log(`  ${file} → ⚠ error: ${err.message}, skipping`);
    }
  }

  // ── Step 3: Summary ──────────────────────────────────────────────────
  console.log();
  console.log("=== Summary ===");
  console.log(`  Photos processed: ${totalPhotos}`);
  console.log(`  Total faces found: ${totalFaces}`);
  console.log(`  Matched: ${totalMatched}`);
  console.log(`  Unmatched: ${totalUnmatched}`);
  console.log(
    `  Match rate: ${totalFaces > 0 ? Math.round((totalMatched / totalFaces) * 100) : 0}%`
  );
  console.log();
  console.log("  Per-person breakdown:");

  // Sort by count descending
  const sorted = Object.entries(perPerson).sort((a, b) => b[1].size - a[1].size);
  const maxNameLen = Math.max(...sorted.map(([n]) => n.length));

  for (const [name, photos] of sorted) {
    console.log(
      `    ${name.padEnd(maxNameLen + 1)} found in ${photos.size} photo${photos.size !== 1 ? "s" : ""}`
    );
  }

  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
