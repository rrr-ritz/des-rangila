#!/usr/bin/env node
/**
 * Test Apple Wallet pass generation end-to-end.
 * Creates a test attendee, generates a .pkpass, writes it to /tmp, cleans up.
 *
 * Usage: node scripts/test-apple-pass.js
 */
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { PKPass } = require("passkit-generator");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { resolve, join } = require("path");
const crypto = require("crypto");

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

// ── Constants (mirror lib/passes/apple.ts) ───────────────────────────
const PROJECT_ROOT = resolve(__dirname, "..");
const PASS_MODEL_DIR = join(PROJECT_ROOT, "public", "passModels", "desrangila.pass");

const STATIONS = [
  { id: "jammu-kashmir", name: "JAMMU & KASHMIR + LADAKH", activity: "Hair Clip Making" },
  { id: "himachal-uttarakhand", name: "HIMACHAL + UTTARAKHAND", activity: "Postcard Coloring" },
  { id: "punjab", name: "PUNJAB", activity: "Paneer Tikka" },
  { id: "haryana-rajasthan", name: "HARYANA + RAJASTHAN", activity: "Block Printing" },
  { id: "gujarat", name: "GUJARAT", activity: "Dandiya Making" },
  { id: "maharashtra", name: "MAHARASHTRA", activity: "Vada Pav" },
  { id: "central-india", name: "CENTRAL INDIA", activity: "Chai Latte Samples" },
  { id: "odisha", name: "ODISHA", activity: "Mehendi / Henna" },
  { id: "west-bengal", name: "WEST BENGAL", activity: "Incense Bundles" },
  { id: "seven-sisters-sikkim", name: "SEVEN SISTERS + SIKKIM", activity: "Momos" },
  { id: "andhra-telangana", name: "ANDHRA + TELANGANA", activity: "Biryani" },
  { id: "karnataka", name: "KARNATAKA", activity: "Idli" },
  { id: "tamil-nadu", name: "TAMIL NADU", activity: "Uthappam" },
  { id: "kerala", name: "KERALA", activity: "Pookalam (Flower Rangoli)" },
  { id: "motion-cafe", name: "MOTION CAFE", activity: "Drinks" },
  { id: "registration", name: "CHECK-IN", activity: "" },
  { id: "photo-booth", name: "PHOTO BOOTH", activity: "" },
];

// ── Main ─────────────────────────────────────────────────────────────
(async () => {
  const OUTPUT_PATH = "/tmp/test-pass.pkpass";
  const TEST_QR = "DR-TEST-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const TEST_PIN = String(Math.floor(1000 + Math.random() * 9000));
  let testDocId = null;

  try {
    // ── Step 1: Create test attendee ─────────────────────────────────
    console.log("1. Creating test attendee...");
    const testAttendee = {
      name: "Test PassUser",
      email: "test-pass@example.com",
      pin: TEST_PIN,
      qrPayload: TEST_QR,
      checkedIn: true,
      checkedInAt: Timestamp.now(),
      faceConsentGiven: false,
      stampsCollected: ["punjab", "maharashtra"],
      totalFoodRedemptions: 0,
      maxFoodRedemptions: 7,
      walletPassGenerated: false,
      createdAt: Timestamp.now(),
    };
    const docRef = await db.collection("attendees").add(testAttendee);
    testDocId = docRef.id;
    console.log(`   Created: ${testDocId} (qr: ${TEST_QR}, pin: ${TEST_PIN})`);

    // ── Step 2: Check certs ──────────────────────────────────────────
    console.log("\n2. Checking certificates...");
    const certPath = resolve(PROJECT_ROOT, process.env.APPLE_PASS_CERT_PATH || "");
    const keyPath = resolve(PROJECT_ROOT, process.env.APPLE_PASS_KEY_PATH || "");
    const wwdrPath = resolve(PROJECT_ROOT, process.env.APPLE_WWDR_CERT_PATH || "");

    console.log(`   APPLE_PASS_TYPE_IDENTIFIER: ${process.env.APPLE_PASS_TYPE_IDENTIFIER}`);
    console.log(`   APPLE_TEAM_IDENTIFIER:      ${process.env.APPLE_TEAM_IDENTIFIER}`);
    console.log(`   Signer cert: ${certPath} (exists: ${existsSync(certPath)})`);
    console.log(`   Signer key:  ${keyPath} (exists: ${existsSync(keyPath)})`);
    console.log(`   WWDR cert:   ${wwdrPath} (exists: ${existsSync(wwdrPath)})`);
    console.log(`   Pass model:  ${PASS_MODEL_DIR} (exists: ${existsSync(PASS_MODEL_DIR)})`);

    if (!existsSync(certPath)) throw new Error(`Signer cert not found: ${certPath}`);
    if (!existsSync(keyPath)) throw new Error(`Signer key not found: ${keyPath}`);
    if (!existsSync(wwdrPath)) throw new Error(`WWDR cert not found: ${wwdrPath}`);
    if (!existsSync(PASS_MODEL_DIR)) throw new Error(`Pass model dir not found: ${PASS_MODEL_DIR}`);

    const signerCert = readFileSync(certPath);
    const signerKey = readFileSync(keyPath);
    const wwdrCert = readFileSync(wwdrPath);
    console.log(`   Signer cert size: ${signerCert.length} bytes`);
    console.log(`   Signer key size:  ${signerKey.length} bytes`);
    console.log(`   WWDR cert size:   ${wwdrCert.length} bytes`);

    // ── Step 3: Generate pass ────────────────────────────────────────
    console.log("\n3. Generating .pkpass...");
    const pass = await PKPass.from(
      {
        model: PASS_MODEL_DIR,
        certificates: {
          wwdr: wwdrCert,
          signerCert: signerCert,
          signerKey: signerKey,
          signerKeyPassphrase: process.env.APPLE_PASS_CERT_PASSWORD || "",
        },
      },
      {
        serialNumber: TEST_QR,
        description: "Des Rangila Digital Passport",
        organizationName: "UMD Indian Student Association",
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER,
        teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER,
        foregroundColor: "rgb(245, 230, 200)",
        backgroundColor: "rgb(72, 57, 50)",
        labelColor: "rgb(180, 166, 137)",
        webServiceURL: "https://des-rangila.vercel.app/api/apple-wallet",
        authenticationToken: TEST_QR,
      }
    );

    // Barcode
    pass.setBarcodes({
      format: "PKBarcodeFormatQR",
      message: TEST_QR,
      messageEncoding: "iso-8859-1",
    });

    // Header
    pass.headerFields.push({ key: "eventDate", label: "DATE", value: "11 APR" });

    // Primary
    pass.primaryFields.push({
      key: "stamps",
      label: "TABLES VISITED",
      value: `${testAttendee.stampsCollected.length} / 15`,
    });

    // Secondary
    pass.secondaryFields.push(
      { key: "attendeeName", label: "NAME", value: testAttendee.name },
      { key: "pin", label: "PIN", value: TEST_PIN }
    );

    // Auxiliary
    pass.auxiliaryFields.push({ key: "location", label: "LOCATION", value: "McKeldin Mall East" });

    // Back fields - stations
    for (const station of STATIONS) {
      const visited = testAttendee.stampsCollected.includes(station.id);
      pass.backFields.push({
        key: `station_${station.id.replace(/-/g, "_")}`,
        label: station.name,
        value: visited ? `\u2705 ${station.activity || "Visited"}` : "Not yet visited",
      });
    }

    // Back fields - event info
    pass.backFields.push(
      { key: "eventName", label: "EVENT", value: "Des Rangila \u2014 Tour of India" },
      { key: "hostedBy", label: "HOSTED BY", value: "UMD Indian Student Association" },
      { key: "dateTime", label: "DATE & TIME", value: "April 11, 2026 | 5\u20138 PM" },
      { key: "eventLocation", label: "LOCATION", value: "McKeldin Mall, University of Maryland" },
      { key: "portal", label: "YOUR PHOTOS & STAMPS", value: "https://des-rangila.vercel.app/me" },
      { key: "support", label: "SUPPORT", value: "passport@desrangila.ritvik.it" },
      {
        key: "privacy",
        label: "PRIVACY",
        value: "Face data is stored as a numeric vector and deleted 30 days after the event. See https://des-rangila.vercel.app/privacy for full policy.",
      }
    );

    const buffer = pass.getAsBuffer();

    // ── Step 4: Write to file ────────────────────────────────────────
    writeFileSync(OUTPUT_PATH, buffer);
    console.log(`   Written to: ${OUTPUT_PATH} (${buffer.length} bytes)`);

    // ── Step 5: Validate ─────────────────────────────────────────────
    console.log("\n4. Validation:");
    console.log(`   File size: ${buffer.length} bytes`);
    // Check it's a valid ZIP (PKZip magic bytes: 50 4B 03 04)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      console.log("   ZIP magic bytes: OK (valid PKZip)");
    } else {
      console.log(`   ZIP magic bytes: FAIL (got ${buffer[0].toString(16)} ${buffer[1].toString(16)})`);
    }

    console.log("\n   SUCCESS! To inspect:");
    console.log(`   unzip -l ${OUTPUT_PATH}`);
    console.log(`   open ${OUTPUT_PATH}  # macOS Wallet preview`);

  } catch (err) {
    console.error("\n   FAILED:", err.message || err);
    if (err.stack) console.error(err.stack);
  } finally {
    // ── Cleanup: delete test attendee ────────────────────────────────
    if (testDocId) {
      console.log(`\n5. Cleaning up test attendee (${testDocId})...`);
      await db.collection("attendees").doc(testDocId).delete();
      console.log("   Deleted.");
    }
  }
})().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
