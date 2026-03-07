import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let authResult;
  try {
    authResult = await verifyAuth(request, "volunteer");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const body = await request.json();
  const { stationId } = body;

  if (!stationId) {
    return NextResponse.json(
      { error: "stationId is required" },
      { status: 400 }
    );
  }

  const ref = adminDb.collection("volunteers").doc(params.id);
  const doc = await ref.get();

  if (!doc.exists) {
    return NextResponse.json(
      { error: "Volunteer not found" },
      { status: 404 }
    );
  }

  const previousStation = doc.data()?.currentStationId;
  await ref.update({ currentStationId: stationId });

  await logAction({
    action: "volunteer.station_changed",
    actorId: authResult.volunteer?.id || authResult.uid,
    actorName: authResult.volunteer?.name || "Volunteer",
    actorRole: "volunteer",
    targetId: params.id,
    targetType: "volunteer",
    details: { previousStation, newStation: stationId },
    severity: "info",
    notifyAdmins: true,
  });

  return NextResponse.json({ success: true });
}
