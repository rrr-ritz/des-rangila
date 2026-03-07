import {
  cacheAttendees,
  cacheStations,
  cacheInventory,
  getUnsynced,
  markSynced,
  type CachedAttendee,
  type CachedStation,
  type CachedInventoryItem,
} from "./db";

/**
 * Fetch all attendee data from the server and cache locally.
 */
export async function syncAttendees(): Promise<number> {
  try {
    const res = await fetch("/api/attendees/sync");
    if (!res.ok) return 0;
    const data = await res.json();
    const attendees: CachedAttendee[] = (data.attendees || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => ({
        id: a.id,
        qrPayload: a.qrPayload,
        pin: a.pin,
        name: a.name,
        email: a.email || "",
        ticketTier: a.ticketTier || "general",
        checkedIn: a.checkedIn || false,
        stampsCollected: a.stampsCollected || [],
        totalFoodRedemptions: a.totalFoodRedemptions || 0,
        maxFoodRedemptions: a.maxFoodRedemptions || 3,
      })
    );
    await cacheAttendees(attendees);
    return attendees.length;
  } catch {
    return 0;
  }
}

/**
 * Fetch station data and cache locally.
 * Falls back to hardcoded stations if API unavailable.
 */
export async function syncStations(): Promise<number> {
  try {
    // No dedicated stations sync endpoint yet — would be added
    // For now, cache the default station set
    const defaultStations: CachedStation[] = [
      { id: "s1", name: "Punjab", type: "both", foodItem: "Chole Bhature", activityName: "Bhangra Workshop", isActive: true },
      { id: "s2", name: "Rajasthan", type: "both", foodItem: "Dal Baati", activityName: "Puppet Making", isActive: true },
      { id: "s3", name: "Gujarat", type: "both", foodItem: "Dhokla", activityName: "Garba Dance", isActive: true },
      { id: "s4", name: "Maharashtra", type: "both", foodItem: "Vada Pav", activityName: "Warli Art", isActive: true },
      { id: "s5", name: "Tamil Nadu", type: "both", foodItem: "Dosa & Chutney", activityName: "Kolam Design", isActive: true },
      { id: "s6", name: "Kerala", type: "both", foodItem: "Banana Chips", activityName: "Kathakali Mask", isActive: true },
      { id: "s7", name: "Karnataka", type: "both", foodItem: "Bisi Bele Bath", activityName: "Mysore Art", isActive: true },
      { id: "s8", name: "West Bengal", type: "both", foodItem: "Rasgulla", activityName: "Alpona Art", isActive: true },
      { id: "s9", name: "Assam", type: "both", foodItem: "Pitha", activityName: "Tea Tasting", isActive: true },
      { id: "s10", name: "Odisha", type: "both", foodItem: "Chhena Poda", activityName: "Pattachitra", isActive: true },
      { id: "s11", name: "Madhya Pradesh", type: "both", foodItem: "Poha Jalebi", activityName: "Gond Art", isActive: true },
      { id: "s12", name: "Uttar Pradesh", type: "both", foodItem: "Chaat", activityName: "Chikankari Demo", isActive: true },
      { id: "s13", name: "Goa", type: "both", foodItem: "Bebinca", activityName: "Tile Painting", isActive: true },
      { id: "s14", name: "Himachal Pradesh", type: "both", foodItem: "Siddu", activityName: "Kullu Shawl Weaving", isActive: true },
      { id: "s15", name: "Photo Booth", type: "photo-booth", foodItem: null, activityName: "Photo Strip", isActive: true },
      { id: "s16", name: "Registration", type: "registration", foodItem: null, activityName: "Check-in", isActive: true },
    ];
    await cacheStations(defaultStations);
    return defaultStations.length;
  } catch {
    return 0;
  }
}

/**
 * Fetch inventory data and cache locally.
 */
export async function syncInventory(): Promise<number> {
  try {
    const res = await fetch("/api/inventory/sync");
    if (!res.ok) return 0;
    const data = await res.json();
    const items: CachedInventoryItem[] = (data.items || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any) => ({
        id: i.id,
        stationId: i.stationId,
        itemName: i.itemName,
        remainingCount: i.remainingCount,
        initialCount: i.initialCount,
      })
    );
    await cacheInventory(items);
    return items.length;
  } catch {
    return 0;
  }
}

/**
 * Flush the redemption queue — attempt to sync all unsynced redemptions.
 * Returns the number successfully synced.
 */
export async function flushRedemptionQueue(): Promise<number> {
  const unsyncedItems = await getUnsynced();
  if (unsyncedItems.length === 0) return 0;

  let synced = 0;
  for (const item of unsyncedItems) {
    try {
      const res = await fetch("/api/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendeeId: item.attendeeId,
          stationId: item.stationId,
          itemType: item.itemType,
          volunteerId: item.volunteerId,
          volunteerName: item.volunteerName,
          idempotencyKey: item.idempotencyKey,
          syncedFromOffline: true,
        }),
      });
      // 200 or 409 (duplicate) both count as synced
      if (res.ok || res.status === 409) {
        await markSynced(item.idempotencyKey);
        synced++;
      }
    } catch {
      // Network error — stop trying, will retry later
      break;
    }
  }
  return synced;
}

/**
 * Full sync — refresh all cached data and flush queue.
 * Called on scanner load and every 5 minutes.
 */
export async function fullSync(): Promise<{
  attendees: number;
  stations: number;
  inventory: number;
  flushed: number;
}> {
  const [attendees, stations, inventory, flushed] = await Promise.all([
    syncAttendees(),
    syncStations(),
    syncInventory(),
    flushRedemptionQueue(),
  ]);
  return { attendees, stations, inventory, flushed };
}
