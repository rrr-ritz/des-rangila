import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "des-rangila";
const DB_VERSION = 1;

export interface CachedAttendee {
  id: string;
  qrPayload: string;
  pin: string;
  name: string;
  email: string;
  ticketTier: string;
  checkedIn: boolean;
  stampsCollected: string[];
  totalFoodRedemptions: number;
  maxFoodRedemptions: number;
}

export interface CachedStation {
  id: string;
  name: string;
  type: string;
  foodItem: string | null;
  activityName: string | null;
  isActive: boolean;
}

export interface CachedInventoryItem {
  id: string;
  stationId: string;
  itemName: string;
  remainingCount: number;
  initialCount: number;
}

export interface QueuedRedemption {
  idempotencyKey: string;
  attendeeQrPayload: string;
  attendeeId: string;
  stationId: string;
  itemType: string;
  volunteerId: string;
  volunteerName: string;
  timestamp: number;
  synced: boolean;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Attendees store — indexed by qrPayload and pin for fast lookup
      if (!db.objectStoreNames.contains("attendees")) {
        const store = db.createObjectStore("attendees", { keyPath: "id" });
        store.createIndex("byQr", "qrPayload", { unique: true });
        store.createIndex("byPin", "pin", { unique: true });
      }

      // Stations store
      if (!db.objectStoreNames.contains("stations")) {
        db.createObjectStore("stations", { keyPath: "id" });
      }

      // Inventory store
      if (!db.objectStoreNames.contains("inventory")) {
        const invStore = db.createObjectStore("inventory", { keyPath: "id" });
        invStore.createIndex("byStation", "stationId");
      }

      // Redemption queue store
      if (!db.objectStoreNames.contains("redemption_queue")) {
        const qStore = db.createObjectStore("redemption_queue", {
          keyPath: "idempotencyKey",
        });
        qStore.createIndex("bySynced", "synced");
      }
    },
  });

  return dbPromise;
}

// === Attendee operations ===

export async function cacheAttendees(attendees: CachedAttendee[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("attendees", "readwrite");
  await Promise.all([
    ...attendees.map((a) => tx.store.put(a)),
    tx.done,
  ]);
}

export async function getAttendeeByQr(
  qrPayload: string
): Promise<CachedAttendee | undefined> {
  const db = await getDb();
  return db.getFromIndex("attendees", "byQr", qrPayload);
}

export async function getAttendeeByPin(
  pin: string
): Promise<CachedAttendee | undefined> {
  const db = await getDb();
  return db.getFromIndex("attendees", "byPin", pin);
}

export async function updateCachedAttendee(
  id: string,
  updates: Partial<CachedAttendee>
): Promise<void> {
  const db = await getDb();
  const existing = await db.get("attendees", id);
  if (existing) {
    await db.put("attendees", { ...existing, ...updates });
  }
}

// === Station operations ===

export async function cacheStations(stations: CachedStation[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("stations", "readwrite");
  await Promise.all([
    ...stations.map((s) => tx.store.put(s)),
    tx.done,
  ]);
}

export async function getAllStations(): Promise<CachedStation[]> {
  const db = await getDb();
  return db.getAll("stations");
}

// === Inventory operations ===

export async function cacheInventory(items: CachedInventoryItem[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("inventory", "readwrite");
  await Promise.all([
    ...items.map((i) => tx.store.put(i)),
    tx.done,
  ]);
}

export async function getInventoryByStation(
  stationId: string
): Promise<CachedInventoryItem[]> {
  const db = await getDb();
  return db.getAllFromIndex("inventory", "byStation", stationId);
}

// === Redemption queue operations ===

export async function enqueueRedemption(
  redemption: QueuedRedemption
): Promise<void> {
  const db = await getDb();
  await db.put("redemption_queue", redemption);
}

export async function getUnsynced(): Promise<QueuedRedemption[]> {
  const db = await getDb();
  const all = await db.getAll("redemption_queue");
  return all.filter((item) => !item.synced);
}

export async function markSynced(idempotencyKey: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get("redemption_queue", idempotencyKey);
  if (existing) {
    await db.put("redemption_queue", { ...existing, synced: true });
  }
}

export async function getQueueLength(): Promise<number> {
  const unsyncedItems = await getUnsynced();
  return unsyncedItems.length;
}
