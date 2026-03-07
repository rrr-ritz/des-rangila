import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const [
    attendeesSnap,
    redemptionsSnap,
    volunteersSnap,
    stationsSnap,
    inventorySnap,
  ] = await Promise.all([
    adminDb.collection("attendees").get(),
    adminDb.collection("redemptions").get(),
    adminDb.collection("volunteers").where("isActive", "==", true).get(),
    adminDb.collection("stations").orderBy("order").get(),
    adminDb.collection("inventory").get(),
  ]);

  const attendees = attendeesSnap.docs.map((d) => d.data());
  const totalRegistered = attendees.length;
  const totalCheckedIn = attendees.filter((a) => a.checkedIn).length;
  const totalStamps = attendees.reduce(
    (sum, a) => sum + (a.stampsCollected?.length || 0),
    0
  );
  const avgCompletion =
    totalRegistered > 0
      ? ((totalStamps / (totalRegistered * 16)) * 100).toFixed(1)
      : "0";

  // Count redemptions per station
  const visitCounts: Record<string, number> = {};
  for (const doc of redemptionsSnap.docs) {
    const sid = doc.data().stationId;
    if (sid) visitCounts[sid] = (visitCounts[sid] || 0) + 1;
  }

  // Count active volunteers per station
  const volCounts: Record<string, number> = {};
  for (const doc of volunteersSnap.docs) {
    const sid = doc.data().currentStationId;
    if (sid) volCounts[sid] = (volCounts[sid] || 0) + 1;
  }

  // Build inventory lookup: stationId → percent remaining
  const invPercent: Record<string, number> = {};
  for (const doc of inventorySnap.docs) {
    const d = doc.data();
    if (d.stationId && d.initialCount > 0) {
      invPercent[d.stationId] = Math.round(
        (d.remainingCount / d.initialCount) * 100
      );
    }
  }

  // Build enriched station list
  const stations = stationsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      region: d.region || "",
      type: d.type,
      activityName: d.activityName || null,
      foodItem: d.foodItem || null,
      tableNumber: d.tableNumber || 0,
      order: d.order || 0,
      isActive: d.isActive,
      visitCount: visitCounts[doc.id] || 0,
      volunteerCount: volCounts[doc.id] || 0,
      inventoryPercent: invPercent[doc.id] ?? null,
    };
  });

  return NextResponse.json({
    totalRegistered,
    totalCheckedIn,
    totalRedemptions: redemptionsSnap.size,
    activeVolunteers: volunteersSnap.size,
    totalStations: stationsSnap.size,
    avgCompletionRate: parseFloat(avgCompletion),
    stations,
  });
}
