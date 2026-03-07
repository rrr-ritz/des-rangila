const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const { resolve } = require("path");
const crypto = require("crypto");

const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq);
  const v = t.slice(eq + 1);
  if (!process.env[k]) process.env[k] = v;
}

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

async function main() {
  // Check if already exists
  const existing = await db.collection("attendees").where("email", "==", "ritzr2003@gmail.com").get();
  if (!existing.empty) {
    const d = existing.docs[0].data();
    console.log("Test attendee already exists:");
    console.log("  qrPayload:", d.qrPayload);
    console.log("  pin:", d.pin);
    return;
  }

  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const qrPayload = crypto.randomBytes(8).toString("hex");
  const now = Timestamp.now();

  const ref = db.collection("attendees").doc();
  await ref.set({
    id: ref.id,
    pin,
    qrPayload,
    name: "Ritvik Rangaraju",
    email: "ritzr2003@gmail.com",
    ticketTier: "general",
    checkedIn: false,
    checkedInAt: null,
    faceDescriptor: null,
    faceConsentGiven: false,
    stampsCollected: [],
    totalFoodRedemptions: 0,
    maxFoodRedemptions: 5,
    walletPassGenerated: false,
    walletPassType: null,
    createdAt: now,
    updatedAt: now,
  });

  console.log("Test attendee created:");
  console.log("  id:", ref.id);
  console.log("  qrPayload:", qrPayload);
  console.log("  pin:", pin);
}

main().catch(console.error);
