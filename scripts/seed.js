#!/usr/bin/env node

/**
 * Seed script for Des Rangila Firestore — stations + inventory.
 *
 * Usage:  node scripts/seed.js
 *
 * Reads FIREBASE_SERVICE_ACCOUNT_KEY from .env.local.
 * Idempotent: uses deterministic doc IDs and set-with-merge,
 * so it's safe to run multiple times.
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const { resolve } = require("path");

// ── Load .env.local ─────────────────────────────────────────────────
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

// ── Firebase Admin init ─────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// ── Station data ────────────────────────────────────────────────────
const stations = [
  {
    id: "station-01",
    name: "Jammu & Kashmir + Ladakh",
    region: "Jammu & Kashmir, Ladakh",
    type: "activity",
    activityName: "Hair Clip Making",
    foodItem: null,
    tableNumber: 1,
    order: 1,
    isActive: true,
  },
  {
    id: "station-02",
    name: "Himachal + Uttarakhand",
    region: "Himachal Pradesh, Uttarakhand",
    type: "activity",
    activityName: "Postcard Coloring",
    foodItem: null,
    tableNumber: 2,
    order: 2,
    isActive: true,
  },
  {
    id: "station-03",
    name: "Punjab",
    region: "Punjab",
    type: "food",
    activityName: null,
    foodItem: "Mango Lassi Shots",
    tableNumber: 3,
    order: 3,
    isActive: true,
  },
  {
    id: "station-04",
    name: "Haryana + Rajasthan",
    region: "Haryana, Rajasthan",
    type: "activity",
    activityName: "Block Printing",
    foodItem: null,
    tableNumber: 4,
    order: 4,
    isActive: true,
  },
  {
    id: "station-05",
    name: "Gujarat",
    region: "Gujarat",
    type: "activity",
    activityName: "Dandiya Making",
    foodItem: null,
    tableNumber: 5,
    order: 5,
    isActive: true,
  },
  {
    id: "station-06",
    name: "Maharashtra",
    region: "Maharashtra",
    type: "food",
    activityName: null,
    foodItem: "Vada Pav",
    tableNumber: 6,
    order: 6,
    isActive: true,
  },
  {
    id: "station-07",
    name: "Central India",
    region: "Uttar Pradesh, Madhya Pradesh, Chhattisgarh, Jharkhand, Bihar",
    type: "food",
    activityName: null,
    foodItem: "Chai",
    tableNumber: 7,
    order: 7,
    isActive: true,
  },
  {
    id: "station-08",
    name: "Odisha",
    region: "Odisha",
    type: "activity",
    activityName: "Mehendi / Henna",
    foodItem: null,
    tableNumber: 8,
    order: 8,
    isActive: true,
  },
  {
    id: "station-09",
    name: "West Bengal",
    region: "West Bengal",
    type: "activity",
    activityName: "Polaroid Photo Booth",
    foodItem: null,
    tableNumber: 9,
    order: 9,
    isActive: true,
  },
  {
    id: "station-10",
    name: "Seven Sisters + Sikkim",
    region: "Northeast India, Sikkim",
    type: "food",
    activityName: null,
    foodItem: "Momos",
    tableNumber: 10,
    order: 10,
    isActive: true,
  },
  {
    id: "station-11",
    name: "Andhra Pradesh + Telangana",
    region: "Andhra Pradesh, Telangana",
    type: "food",
    activityName: null,
    foodItem: "Biryani",
    tableNumber: 11,
    order: 11,
    isActive: true,
  },
  {
    id: "station-12",
    name: "Karnataka",
    region: "Karnataka",
    type: "food",
    activityName: null,
    foodItem: "Idli",
    tableNumber: 12,
    order: 12,
    isActive: true,
  },
  {
    id: "station-13",
    name: "Tamil Nadu",
    region: "Tamil Nadu",
    type: "food",
    activityName: null,
    foodItem: "Uthappam",
    tableNumber: 13,
    order: 13,
    isActive: true,
  },
  {
    id: "station-14",
    name: "Kerala",
    region: "Kerala",
    type: "activity",
    activityName: "Pookalam / Flower Rangoli",
    foodItem: null,
    tableNumber: 14,
    order: 14,
    isActive: true,
  },
  {
    id: "station-15",
    name: "Registration / Passport Table",
    region: "Registration",
    type: "registration",
    activityName: null,
    foodItem: null,
    tableNumber: 15,
    order: 15,
    isActive: true,
  },
  {
    id: "station-16",
    name: "Photo Booth Station",
    region: "Photo Booth",
    type: "photo-booth",
    activityName: null,
    foodItem: null,
    tableNumber: 16,
    order: 16,
    isActive: true,
  },
];

// ── Inventory data (food stations only) ─────────────────────────────
// Estimates for ~200 attendees. lowStockThreshold = 25% of initialCount.
const inventory = [
  {
    id: "inv-03-lassi",
    stationId: "station-03",
    itemName: "Mango Lassi Shots",
    itemType: "food",
    initialCount: 250,
    remainingCount: 250,
    unit: "cups",
    lowStockThreshold: 63,
    depletedAt: null,
  },
  {
    id: "inv-06-vadapav",
    stationId: "station-06",
    itemName: "Vada Pav",
    itemType: "food",
    initialCount: 220,
    remainingCount: 220,
    unit: "pieces",
    lowStockThreshold: 55,
    depletedAt: null,
  },
  {
    id: "inv-07-chai",
    stationId: "station-07",
    itemName: "Chai",
    itemType: "food",
    initialCount: 300,
    remainingCount: 300,
    unit: "cups",
    lowStockThreshold: 75,
    depletedAt: null,
  },
  {
    id: "inv-10-momos",
    stationId: "station-10",
    itemName: "Momos",
    itemType: "food",
    initialCount: 400,
    remainingCount: 400,
    unit: "pieces",
    lowStockThreshold: 100,
    depletedAt: null,
  },
  {
    id: "inv-11-biryani",
    stationId: "station-11",
    itemName: "Biryani",
    itemType: "food",
    initialCount: 220,
    remainingCount: 220,
    unit: "servings",
    lowStockThreshold: 55,
    depletedAt: null,
  },
  {
    id: "inv-12-idli",
    stationId: "station-12",
    itemName: "Idli",
    itemType: "food",
    initialCount: 400,
    remainingCount: 400,
    unit: "pieces",
    lowStockThreshold: 100,
    depletedAt: null,
  },
  {
    id: "inv-13-uthappam",
    stationId: "station-13",
    itemName: "Uthappam",
    itemType: "food",
    initialCount: 220,
    remainingCount: 220,
    unit: "pieces",
    lowStockThreshold: 55,
    depletedAt: null,
  },
];

// ── Seed function ───────────────────────────────────────────────────
async function seed() {
  console.log("Seeding Firestore...\n");

  // Seed stations
  console.log("--- Stations ---");
  for (const station of stations) {
    const { id, ...data } = station;
    await db.collection("stations").doc(id).set(data, { merge: true });
    console.log(`  [${station.type.padEnd(12)}] ${id}  ${station.name}`);
  }
  console.log(`  ✓ ${stations.length} stations seeded\n`);

  // Seed inventory
  console.log("--- Inventory ---");
  for (const item of inventory) {
    const { id, ...data } = item;
    await db.collection("inventory").doc(id).set(data, { merge: true });
    console.log(
      `  ${id}  ${item.itemName} — ${item.initialCount} ${item.unit} (low at ${item.lowStockThreshold})`
    );
  }
  console.log(`  ✓ ${inventory.length} inventory items seeded\n`);

  console.log("Done! Firestore has been seeded.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
