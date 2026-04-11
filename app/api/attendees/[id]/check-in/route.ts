import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";
import { sendPassSMS, isSmsConfigured } from "@/lib/sms/twilio";
import { generatePin, generateQrPayload } from "@/lib/pin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let authResult;
  try {
    authResult = await verifyAuth(request, "volunteer");
  } catch {
    // Admins also use this endpoint from the check-in page
    try {
      authResult = await verifyAuth(request, "admin");
    } catch (e2) {
      if (e2 instanceof AuthError) {
        return NextResponse.json({ error: e2.message }, { status: e2.status });
      }
      throw e2;
    }
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

  // Generate PIN and QR payload if missing (pre-order attendees have empty strings)
  let pin = data.pin;
  let qrPayload = data.qrPayload;

  if (!pin || !qrPayload) {
    // Fetch all existing PINs and QR payloads to avoid collisions
    const allAttendees = await adminDb.collection("attendees").get();
    const existingPins = new Set<string>();
    const existingQrs = new Set<string>();
    allAttendees.docs.forEach((d) => {
      const a = d.data();
      if (a.pin) existingPins.add(a.pin);
      if (a.qrPayload) existingQrs.add(a.qrPayload);
    });

    if (!pin) {
      do { pin = generatePin(); } while (existingPins.has(pin));
    }
    if (!qrPayload) {
      do { qrPayload = generateQrPayload(); } while (existingQrs.has(qrPayload));
    }
  }

  const now = Timestamp.now();
  const updateData: Record<string, unknown> = {
    checkedIn: true,
    checkedInAt: now,
    updatedAt: now,
    pin,
    qrPayload,
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
    const passUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://des-rangila.vercel.app"}/pass/${qrPayload}`;
    try {
      const result = await sendPassSMS(updateData.phone as string, pin, passUrl);
      smsSent = result.success;
      smsError = !result.success;
      if (result.success) {
        await ref.update({ smsSentAt: now });
      }
    } catch {
      smsError = true;
    }
  }

  return NextResponse.json({ success: true, checkedInAt: now, pin, qrPayload, smsSent, smsError });
}
