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

  const [attendeesSnap, redemptionsSnap, volunteersSnap, stationsSnap] =
    await Promise.all([
      adminDb.collection("attendees").get(),
      adminDb.collection("redemptions").get(),
      adminDb.collection("volunteers").where("isActive", "==", true).get(),
      adminDb.collection("stations").get(),
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

  return NextResponse.json({
    totalRegistered,
    totalCheckedIn,
    totalRedemptions: redemptionsSnap.size,
    activeVolunteers: volunteersSnap.size,
    totalStations: stationsSnap.size,
    avgCompletionRate: parseFloat(avgCompletion),
  });
}
