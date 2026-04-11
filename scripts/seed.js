#!/usr/bin/env node

/**
 * Seed script for Des Rangila Firestore — stations + inventory.
 *
 * Usage:  node scripts/seed.js
 *
 * Reads FIREBASE_SERVICE_ACCOUNT_KEY from .env.local.
 * Idempotent: deletes existing stations/inventory first, then writes fresh data.
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
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
  { id: "jammu-kashmir", name: "Jammu & Kashmir + Ladakh", region: "Jammu & Kashmir, Ladakh", type: "activity", activityName: "Hair Clip Making", foodItem: null, tableNumber: 1, order: 1, isActive: true },
  { id: "himachal-uttarakhand", name: "Himachal + Uttarakhand", region: "Himachal Pradesh, Uttarakhand", type: "activity", activityName: "Postcard Coloring", foodItem: null, tableNumber: 2, order: 2, isActive: true },
  { id: "punjab", name: "Punjab", region: "Punjab", type: "food", activityName: null, foodItem: "Paneer Tikka", tableNumber: 3, order: 3, isActive: true },
  { id: "haryana-rajasthan", name: "Haryana + Rajasthan", region: "Haryana, Rajasthan", type: "activity", activityName: "Block Printing", foodItem: null, tableNumber: 4, order: 4, isActive: true },
  { id: "gujarat", name: "Gujarat", region: "Gujarat", type: "activity", activityName: "Dandiya Making", foodItem: null, tableNumber: 5, order: 5, isActive: true },
  { id: "maharashtra", name: "Maharashtra", region: "Maharashtra", type: "food", activityName: null, foodItem: "Vada Pav", tableNumber: 6, order: 6, isActive: true },
  { id: "central-india", name: "Central India", region: "Uttar Pradesh, Madhya Pradesh, Chhattisgarh, Jharkhand, Bihar", type: "food", activityName: null, foodItem: "Chai Latte Samples", tableNumber: 7, order: 7, isActive: true },
  { id: "odisha", name: "Odisha", region: "Odisha", type: "activity", activityName: "Mehendi", foodItem: null, tableNumber: 8, order: 8, isActive: true },
  { id: "west-bengal", name: "West Bengal", region: "West Bengal", type: "activity", activityName: "Incense", foodItem: null, tableNumber: 9, order: 9, isActive: true },
  { id: "seven-sisters-sikkim", name: "Seven Sisters + Sikkim", region: "Northeast India, Sikkim", type: "food", activityName: null, foodItem: "Momos", tableNumber: 10, order: 10, isActive: true },
  { id: "andhra-telangana", name: "Andhra Pradesh + Telangana", region: "Andhra Pradesh, Telangana", type: "food", activityName: null, foodItem: "Biryani", tableNumber: 11, order: 11, isActive: true },
  { id: "karnataka", name: "Karnataka", region: "Karnataka", type: "food", activityName: null, foodItem: "Idli", tableNumber: 12, order: 12, isActive: true },
  { id: "tamil-nadu", name: "Tamil Nadu", region: "Tamil Nadu", type: "food", activityName: null, foodItem: "Uthappam", tableNumber: 13, order: 13, isActive: true },
  { id: "kerala", name: "Kerala", region: "Kerala", type: "activity", activityName: "Pookalam", foodItem: null, tableNumber: 14, order: 14, isActive: true },
  { id: "motion-cafe", name: "Motion Cafe", region: "Motion Cafe", type: "none", activityName: null, foodItem: null, tableNumber: 15, order: 15, isActive: true },
  { id: "registration", name: "Check-In", region: "Registration", type: "registration", activityName: null, foodItem: null, tableNumber: 16, order: 16, isActive: true },
  { id: "photo-booth-1", name: "Photo Booth 1", region: "Photo Booth", type: "none", activityName: null, foodItem: null, tableNumber: 17, order: 17, isActive: true },
  { id: "photo-booth-2", name: "Photo Booth 2", region: "Photo Booth", type: "none", activityName: null, foodItem: null, tableNumber: 18, order: 18, isActive: true },
];

// ── Inventory data (food stations only) ─────────────────────────────
// Placeholder estimates for ~200 attendees. lowStockThreshold = 25% of initialCount.
const inventory = [
  { id: "inv-jammu-kashmir", stationId: "jammu-kashmir", itemName: "Hair Clip Making", itemType: "activity-supply", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-himachal-uttarakhand", stationId: "himachal-uttarakhand", itemName: "Postcard Coloring", itemType: "activity-supply", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-punjab", stationId: "punjab", itemName: "Paneer Tikka", itemType: "food", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-haryana-rajasthan", stationId: "haryana-rajasthan", itemName: "Block Printing", itemType: "activity-supply", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-gujarat", stationId: "gujarat", itemName: "Dandiya Making", itemType: "activity-supply", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-maharashtra", stationId: "maharashtra", itemName: "Vada Pav", itemType: "food", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-central-india", stationId: "central-india", itemName: "Chai Latte Samples", itemType: "food", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-odisha", stationId: "odisha", itemName: "Mehendi", itemType: "activity-supply", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-west-bengal", stationId: "west-bengal", itemName: "Incense", itemType: "activity-supply", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-seven-sisters", stationId: "seven-sisters-sikkim", itemName: "Momos", itemType: "food", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-andhra-telangana", stationId: "andhra-telangana", itemName: "Biryani", itemType: "food", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-karnataka", stationId: "karnataka", itemName: "Idli", itemType: "food", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-tamil-nadu", stationId: "tamil-nadu", itemName: "Uthappam", itemType: "food", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
  { id: "inv-kerala", stationId: "kerala", itemName: "Pookalam", itemType: "activity-supply", initialCount: 150, remainingCount: 150, unit: "servings", lowStockThreshold: 30, depletedAt: null },
];

// ── Helper: delete all docs in a collection ─────────────────────────
async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`  (no existing docs)`);
    return 0;
  }
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

// ── Seed function ───────────────────────────────────────────────────
async function seed() {
  console.log("Seeding Firestore...\n");

  // Delete old data
  console.log("--- Clearing old data ---");
  const deletedStations = await deleteCollection("stations");
  console.log(`  Deleted ${deletedStations} old station docs`);
  const deletedInventory = await deleteCollection("inventory");
  console.log(`  Deleted ${deletedInventory} old inventory docs\n`);

  // Seed stations
  console.log("--- Stations ---");
  for (const station of stations) {
    const { id, ...data } = station;
    await db.collection("stations").doc(id).set(data);
    console.log(`  [${station.type.padEnd(12)}] ${id}  ${station.name}`);
  }
  console.log(`  ${stations.length} stations seeded\n`);

  // Seed inventory
  console.log("--- Inventory ---");
  for (const item of inventory) {
    const { id, ...data } = item;
    await db.collection("inventory").doc(id).set(data);
    console.log(`  ${id}  ${item.itemName} — ${item.initialCount} ${item.unit} (low at ${item.lowStockThreshold})`);
  }
  console.log(`  ${inventory.length} inventory items seeded\n`);

  console.log("Done!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
