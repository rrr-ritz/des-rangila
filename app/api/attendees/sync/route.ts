import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

/**
 * Bulk download attendees for offline cache.
 * Returns a minimal payload per attendee (~500 bytes each).
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request, "volunteer");
  } catch {
    try {
      await verifyAuth(request, "admin");
    } catch (e2) {
      if (e2 instanceof AuthError) {
        return NextResponse.json({ error: e2.message }, { status: e2.status });
      }
      throw e2;
    }
  }

  const snapshot = await adminDb.collection("attendees").get();

  const attendees = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      qrPayload: d.qrPayload,
      pin: d.pin,
      name: d.name,
      checkedIn: d.checkedIn,
      stampsCollected: d.stampsCollected,
      totalFoodRedemptions: d.totalFoodRedemptions,
      maxFoodRedemptions: d.maxFoodRedemptions,
    };
  });

  return NextResponse.json({ attendees, count: attendees.length });
}
