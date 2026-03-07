/**
 * Client-side face detection using @vladmandic/face-api.
 * Runs in the browser — loads TF.js models from /models/ directory.
 *
 * Models needed in /public/models/:
 *   - ssd_mobilenetv1_model-weights_manifest.json (+ shards)
 *   - face_landmark_68_model-weights_manifest.json (+ shards)
 *   - face_recognition_model-weights_manifest.json (+ shards)
 *
 * Download from: https://github.com/vladmandic/face-api/tree/master/model
 */

let faceapi: typeof import("@vladmandic/face-api") | null = null;
let modelsLoaded = false;

/**
 * Lazily load face-api.js and its models. Call once before using other functions.
 */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  // Dynamic import to avoid SSR issues (face-api needs DOM/canvas)
  const mod = await import("@vladmandic/face-api");
  faceapi = mod;

  const MODEL_URL = "/models";

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
}

/**
 * Detect a single face in an image/video element and return the 128-dim descriptor.
 * Returns null if no face is detected.
 */
export async function extractDescriptor(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  if (!faceapi) throw new Error("Models not loaded. Call loadModels() first.");

  const detection = await faceapi
    .detectSingleFace(input)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return detection.descriptor;
}

/**
 * Detect all faces in an image and return their descriptors + bounding boxes.
 * Used for batch processing photographer photos.
 */
export async function extractAllDescriptors(
  input: HTMLImageElement | HTMLCanvasElement
): Promise<
  Array<{
    descriptor: Float32Array;
    box: { x: number; y: number; width: number; height: number };
  }>
> {
  if (!faceapi) throw new Error("Models not loaded. Call loadModels() first.");

  const detections = await faceapi
    .detectAllFaces(input)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((d) => ({
    descriptor: d.descriptor,
    box: {
      x: d.detection.box.x,
      y: d.detection.box.y,
      width: d.detection.box.width,
      height: d.detection.box.height,
    },
  }));
}

/**
 * Compare two face descriptors using Euclidean distance.
 * Lower distance = more similar. Threshold: 0.6 (standard for face-api.js).
 */
export function compareDescriptors(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  const arrA = a instanceof Float32Array ? a : new Float32Array(a);
  const arrB = b instanceof Float32Array ? b : new Float32Array(b);

  if (arrA.length !== arrB.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < arrA.length; i++) {
    const diff = arrA[i] - arrB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Standard threshold for face-api.js matches */
export const MATCH_THRESHOLD = 0.6;

/**
 * Find the best matching attendee for a face descriptor.
 * Returns the attendee ID and distance, or null if no match is below threshold.
 */
export function findBestMatch(
  faceDescriptor: Float32Array | number[],
  attendeeDescriptors: Array<{ attendeeId: string; descriptor: number[] }>
): { attendeeId: string; distance: number } | null {
  let bestMatch: { attendeeId: string; distance: number } | null = null;

  for (const attendee of attendeeDescriptors) {
    const distance = compareDescriptors(faceDescriptor, attendee.descriptor);
    if (distance < MATCH_THRESHOLD) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { attendeeId: attendee.attendeeId, distance };
      }
    }
  }

  return bestMatch;
}
