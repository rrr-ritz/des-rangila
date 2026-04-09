#!/usr/bin/env node
/**
 * Delete all documents from test/transactional Firestore collections.
 * Keeps stations and inventory intact.
 *
 * Usage: node scripts/clear-test-data.js
 */
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const { resolve } = require("path");

// ── Load .env.local ──────────────────────────────────────────────────
const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = value;
}

// ── Firebase Admin init ──────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// ── Collections to wipe ──────────────────────────────────────────────
const COLLECTIONS_TO_CLEAR = [
  "attendees",
  "redemptions",
  "volunteers",
  "photos",
  "face_match_queue",
  "audit_log",
  "apple_wallet_registrations",
];

/**
 * Delete all documents in a collection using chunked batches (max 500 per batch).
 */
async function deleteCollection(name) {
  const snapshot = await db.collection(name).get();
  if (snapshot.empty) {
    return 0;
  }

  const docs = snapshot.docs;
  const BATCH_SIZE = 500;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  return docs.length;
}

// ── Main ─────────────────────────────────────────────────────────────
(async () => {
  console.log("Clearing test data from Firestore...\n");

  let totalDeleted = 0;

  for (const name of COLLECTIONS_TO_CLEAR) {
    const count = await deleteCollection(name);
    const label = count > 0 ? `  ${count} deleted` : "  (empty)";
    console.log(`  ${name}: ${label}`);
    totalDeleted += count;
  }

  console.log(`\nDone. ${totalDeleted} documents deleted across ${COLLECTIONS_TO_CLEAR.length} collections.`);
  console.log("Kept: stations, inventory");
})().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
