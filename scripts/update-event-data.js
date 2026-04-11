#!/usr/bin/env node

/**
 * Event-day data update for Des Rangila.
 *
 * 1. Updates station types/items (no "both" — each is food OR activity)
 * 2. Adds Photo Booth 1 & 2, makes Motion Cafe non-stampable
 * 3. Seeds inventory (150 per stampable station)
 * 4. Deletes 5 test attendees
 * 5. Imports 167 DoorList pre-order attendees
 *
 * Usage:  node scripts/update-event-data.js
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");

// ── Load env ───────────────────────────────────────────────────────
// Try .env.local first, fall back to GOOGLE_APPLICATION_CREDENTIALS
const envPath = resolve(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
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
}

// ── Firebase Admin init ────────────────────────────────────────────
let app;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
  app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(sa) });
} else {
  console.error("ERROR: No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}
const db = getFirestore(app);

// ── Station definitions ────────────────────────────────────────────
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

// ── Inventory (14 stampable stations, 150 each) ────────────────────
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

// ── Test attendees to delete ───────────────────────────────────────
const TEST_NAMES = ["Emily Johnson", "Jake Mitchell", "Sarah Thompson", "Ryan Cooper", "Megan Davis"];

// ── DoorList (167 pre-order attendees) ─────────────────────────────
const DOORLIST_RAW = `A K, 1
Aaishi Pranav, 1
Aaniya Dahiya, 1
Aarushi Kapoor, 1
Aditi Nagaraja, 1
Aditya Hardikar, 1
Ak Ra, 1
Akash S Vora, 1
Akshita Badkundri, 4
Alisha Wu, 1
Aniket Shah, 1
Aniketh Metpalli, 1
Anjali Vidyasagar, 1
Anusha Sh, 1
Anushka Jain, 1
Ariel Kim, 1
Arnav Dadarya, 1
Arnav Patel, 1
Arnica D Rozario, 1
Arpita Kwatra, 1
Arya Ram, 1
Ava Daly, 1
Avni Uniyal, 1
Ayush Vispute, 1
Benjamin Nathan, 1
Bhargavi Alluri, 1
Bipasha Sharma, 1
Brooke Snellman, 1
Dakshita Pal, 1
Devanshu Kejriwal, 1
Dhanya Krishnan, 1
Dhruv Agarwal, 1
Dhruv Iyer, 1
Dhruv Suri, 2
Eulalia Voo, 1
FNU Mahek, 1
Fatmatta Mbai, 1
Gale De Silva, 1
Gia Ahuja, 1
Harshitha Karippara, 1
Himanshu Gediya, 1
Isha Rajani, 1
Ishara Shanmugasundaram, 1
Izzy Tucker, 1
Janki Patel, 1
Jasmine Saluja, 1
Jaspreet Soni, 1
Jay Kammula, 2
Jess Jacklitch, 1
Kai-Lin Yu, 1
Kartik Bhatia, 1
Kenneth Vasquez, 1
Khushbu Pohani, 1
Kitty Shi, 1
Kripa Krishnan, 1
Kriti Shahi, 1
Laasya Madduri, 1
Lakshmi Adibhatla, 2
Lakshya Sajal, 1
Lauren Shilling, 1
Lia Stearns, 1
Lilli Terry, 1
Lin Tomohara, 1
Maethili Patel, 1
Mahek Shah, 1
Mahima Shenoy, 1
Malhar Mandsaurwale, 1
Manasa Alur, 1
Manasi Deepak, 1
Mann Parekh, 1
Manyatha Kallukurthi, 1
Mateo Rojas, 1
Mayeesha Ghani, 2
Meenal Dudani, 1
Namratha Jeetendra, 1
Navya Pandit, 1
Ne Se, 2
Nehi Pathak, 1
Nicholas Seecharan, 1
Nikhil Mantha, 1
Nishtha Gupta, 1
Nithya Nuvvala, 1
Niti poddar, 1
Nivi Munjal, 1
Om Arya, 1
Palak Gupta, 1
Pavan Kundeti, 1
Peri peri, 1
Pooja Raghuram, 1
Preet Lal, 2
Prisha Ni, 1
Priyanka Iyer, 1
Priyanshi Madhukar, 1
Purva Chimurkar, 1
Rahul Ramasubramanian, 1
Raj Bhansali, 1
Ratra Singh, 2
Raveena Ananth, 1
Rhea Ovungal, 1
Richa Gupta, 1
Richa Patil, 1
Risha Thomas, 1
Rishi Mehta, 1
Ritvik Rangaraju, 1
Riya Patel, 1
Roy Sharma, 1
Rushil Juneja, 1
SIMRAN GAWRI, 1
Saanvi Gupta, 1
Saharah Sinkler, 1
Sai Madhira, 1
Saloni Gupta, 1
Samarth Jethani, 1
Sanjanaa Viswanathan, 1
Sarayu Vanam, 1
Sayee Naresh, 1
Shivani Sogal, 1
Shivank Bhimavarapu, 1
Shohag Sen, 1
Shraddha Chandrashekar, 1
Shravan Suresh, 1
Shreya Gupta, 1
Shriya Goyal, 1
Shriya Krishnan, 1
Shruti Khetade, 1
Sneha Raj, 1
Sofia Asuncion, 1
Sophia Chen, 1
Sravya Patibandla, 1
Sreeja Harinarthini, 1
Sreya Kanchi, 1
Srikara Sai, 1
Sruthika Potluri, 1
Stuti Pardiwala, 1
Sukrit Mangla, 1
Surya Dineshkumar, 1
Surya Kolluri, 1
Suvrath Chivukula, 1
Swetanshu Arun, 1
Tahmari Lewis, 1
Tanishtha Pawar, 1
Tanvi Kotta, 1
Taruni Pendyala, 1
Tejaswini Balini, 1
Timila Jonchhe, 1
Tisha Patel, 1
Tulika Kumar, 1
Urvi Panjwani, 1
Vamekha Senthil Kumar, 1
Varun Somashekar, 1
Venugopal Pandey, 1
Viharika Penmetsa, 1
Vishnu Sreekanth, 1
Yaalini Lakhani, 1
Yash Porwal, 1
Zoya Rahman, 2
aarushi soni, 1
anika keshri, 1
arshnoor bhutani, 2
krish patel, 1
medha chandra, 1
mohika kataruka, 4
natalia dcosta, 1
riya makwana, 1
sayli lim, 1
shukonna pereira, 1
srinidhi gubba, 1`;

function titleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseDoorList(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const lastComma = line.lastIndexOf(",");
      const name = titleCase(line.slice(0, lastComma).trim());
      const ticketCount = parseInt(line.slice(lastComma + 1).trim(), 10) || 1;
      return { name, ticketCount };
    });
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("Des Rangila — Event Data Update");
  console.log("=".repeat(50));

  // ── 1. Update stations ───────────────────────────────────────────
  console.log("\n--- Updating Stations ---");

  // Delete old photo-booth station (being replaced by photo-booth-1 and photo-booth-2)
  try {
    await db.collection("stations").doc("photo-booth").delete();
    console.log("  Deleted old photo-booth station");
  } catch {
    console.log("  (no old photo-booth station to delete)");
  }

  for (const station of stations) {
    const { id, ...data } = station;
    await db.collection("stations").doc(id).set(data);
    const label = station.type === "food" ? station.foodItem : station.activityName || "—";
    console.log(`  [${station.type.padEnd(12)}] ${id.padEnd(24)} ${label}`);
  }
  console.log(`  ${stations.length} stations written`);

  // ── 2. Seed inventory ────────────────────────────────────────────
  console.log("\n--- Seeding Inventory ---");

  // Delete existing inventory
  const oldInv = await db.collection("inventory").get();
  if (!oldInv.empty) {
    const batch = db.batch();
    oldInv.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`  Deleted ${oldInv.size} old inventory items`);
  }

  for (const item of inventory) {
    const { id, ...data } = item;
    await db.collection("inventory").doc(id).set(data);
    console.log(`  ${id.padEnd(28)} ${item.itemName} — ${item.initialCount} ${item.unit}`);
  }
  console.log(`  ${inventory.length} inventory items seeded`);

  // ── 3. Delete test attendees ─────────────────────────────────────
  console.log("\n--- Deleting Test Attendees ---");
  let deletedCount = 0;
  const allAttendees = await db.collection("attendees").get();
  for (const doc of allAttendees.docs) {
    const name = doc.data().name;
    if (TEST_NAMES.includes(name)) {
      await db.collection("attendees").doc(doc.id).delete();
      console.log(`  Deleted: ${name} (${doc.id})`);
      deletedCount++;
    }
  }
  console.log(`  ${deletedCount} test attendees deleted`);

  // ── 4. Import DoorList ───────────────────────────────────────────
  console.log("\n--- Importing DoorList ---");
  const doorList = parseDoorList(DOORLIST_RAW);
  console.log(`  Parsed ${doorList.length} entries from DoorList`);

  // Get existing attendee names to skip duplicates
  const existingNames = new Set(allAttendees.docs.map((d) => d.data().name));
  // Remove deleted test names from the set
  TEST_NAMES.forEach((n) => existingNames.delete(n));

  let imported = 0;
  let skipped = 0;

  for (const entry of doorList) {
    if (existingNames.has(entry.name)) {
      console.log(`  Skipped (exists): ${entry.name}`);
      skipped++;
      continue;
    }

    await db.collection("attendees").add({
      name: entry.name,
      ticketCount: entry.ticketCount,
      email: "",
      pin: "",
      qrPayload: "",
      checkedIn: false,
      checkedInAt: null,
      preOrder: true,
      stampsCollected: [],
      totalFoodRedemptions: 0,
      maxFoodRedemptions: 7,
      faceDescriptor: null,
      faceConsentGiven: false,
      selfieStorageUrl: null,
      walletPassGenerated: false,
      walletPassType: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    existingNames.add(entry.name);
    imported++;
  }

  console.log(`  ${imported} attendees imported, ${skipped} skipped (already exist)`);

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("Summary:");
  console.log(`  Stations: ${stations.length}`);
  console.log(`  Inventory items: ${inventory.length}`);
  console.log(`  Test attendees deleted: ${deletedCount}`);
  console.log(`  DoorList attendees imported: ${imported}`);
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
