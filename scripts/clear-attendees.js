#!/usr/bin/env node
/**
 * Delete all attendees from Firestore.
 * Usage: node scripts/clear-attendees.js
 */
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const { resolve } = require("path");

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

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

(async () => {
  const snapshot = await db.collection("attendees").get();
  if (snapshot.empty) {
    console.log("No attendees found.");
    return;
  }
  console.log(`Found ${snapshot.size} attendees. Deleting...`);
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Deleted ${snapshot.size} attendees.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
