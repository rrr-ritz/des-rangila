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
  const k = t.slice(0, eq);
  const v = t.slice(eq + 1);
  if (!process.env[k]) process.env[k] = v;
}

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

db.collection("attendees").limit(5).get().then((snap) => {
  if (snap.empty) {
    console.log("NO ATTENDEES FOUND");
    return;
  }
  snap.docs.forEach((d) => {
    const a = d.data();
    console.log(JSON.stringify({ id: d.id, name: a.name, email: a.email, qrPayload: a.qrPayload, pin: a.pin }));
  });
}).catch((e) => console.error(e));
