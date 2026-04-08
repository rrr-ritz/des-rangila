#!/usr/bin/env node
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const { resolve } = require("path");

const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  if (!process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
}

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

(async () => {
  const snap = await db.collection("attendees").get();
  snap.docs.forEach((d) => {
    const data = d.data();
    console.log(d.id, data.name, "qr:", data.qrPayload, "pin:", data.pin);
  });
  console.log("Total:", snap.size);
})();
