import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";
import { sendPassSMS, isSmsConfigured } from "@/lib/sms/twilio";

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

  // Accept optional phone from request body
  let phone: string | undefined;
  try {
    const body = await request.json();
    phone = body.phone;
  } catch {
    // No body or invalid JSON — that's fine, phone is optional
  }

  const now = Timestamp.now();
  const updateData: Record<string, unknown> = {
    checkedIn: true,
    checkedInAt: now,
    updatedAt: now,
  };

  // Store phone if provided
  if (phone && typeof phone === "string" && phone.trim().length >= 10) {
    const digits = phone.replace(/\D/g, "");
    const normalizedPhone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : phone.trim();
    updateData.phone = normalizedPhone;
  }

  await ref.update(updateData);

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

  // Send SMS if phone was provided
  let smsSent = false;
  let smsError = false;
  if (updateData.phone && isSmsConfigured()) {
    const passUrl = `https://desrangila.ritvik.it/pass/${params.id}`;
    try {
      const result = await sendPassSMS(updateData.phone as string, data.pin, passUrl);
      smsSent = result.success;
      smsError = !result.success;
      if (result.success) {
        await ref.update({ smsSentAt: now });
      }
    } catch {
      smsError = true;
    }
  }

  return NextResponse.json({ success: true, checkedInAt: now, smsSent, smsError });
}
