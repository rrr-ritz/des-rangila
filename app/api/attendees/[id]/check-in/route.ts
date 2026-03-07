import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
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

  const ref = adminDb.collection("attendees").doc(params.id);
  const doc = await ref.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const data = doc.data()!;

  if (data.checkedIn) {
    return NextResponse.json(
      { error: "Already checked in", checkedInAt: data.checkedInAt },
      { status: 409 }
    );
  }

  const now = Timestamp.now();
  await ref.update({
    checkedIn: true,
    checkedInAt: now,
    updatedAt: now,
  });

  await logAction({
    action: "attendee.checked_in",
    actorId: authResult.volunteer?.id || authResult.uid,
    actorName: authResult.volunteer?.name || "Volunteer",
    actorRole: "volunteer",
    targetId: params.id,
    targetType: "attendee",
    details: { attendeeName: data.name },
    severity: "info",
    notifyAdmins: false,
  });

  return NextResponse.json({ success: true, checkedInAt: now });
}
