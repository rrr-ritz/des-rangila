import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { generatePin, generateQrPayload } from "@/lib/pin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";
import { sendPassSMS, isSmsConfigured } from "@/lib/sms/twilio";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://des-rangila.vercel.app";

/**
 * POST /api/attendees/walk-in
 * Register a walk-in attendee on the spot.
 * Accepts { name, phone?, email? }, generates PIN + QR, creates Firestore doc,
 * optionally sends SMS, and returns the created attendee.
 * Requires volunteer or admin auth.
 */
export async function POST(request: NextRequest) {
  let auth;
  try {
    auth = await verifyAuth(request, "volunteer");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  try {
    const body = await request.json();
    const { name, phone, email } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Normalize phone if provided
    let normalizedPhone = "";
    if (phone && typeof phone === "string" && phone.trim().length >= 10) {
      const digits = phone.replace(/\D/g, "");
      normalizedPhone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : phone.trim();
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : "";

    // Check for duplicate by phone (only if phone provided) or by name
    if (normalizedPhone) {
      const existingSnapshot = await adminDb
        .collection("attendees")
        .where("phone", "==", normalizedPhone)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        const existingData = existingDoc.data();
        return NextResponse.json({
          attendee: {
            id: existingDoc.id,
            name: existingData.name,
            phone: existingData.phone || "",
            email: existingData.email || "",
            pin: existingData.pin,
            qrPayload: existingData.qrPayload,
            checkedIn: existingData.checkedIn,
          },
          alreadyExists: true,
        });
      }
    }

    // Collect existing PINs and QR payloads to ensure uniqueness
    const allAttendeesSnapshot = await adminDb.collection("attendees").get();
    const existingPins = new Set(
      allAttendeesSnapshot.docs.map((doc) => doc.data().pin)
    );
    const existingQrPayloads = new Set(
      allAttendeesSnapshot.docs.map((doc) => doc.data().qrPayload)
    );

    // Generate unique PIN
    let pin = generatePin();
    while (existingPins.has(pin)) {
      pin = generatePin();
    }

    // Generate unique QR payload
    let qrPayload = generateQrPayload();
    while (existingQrPayloads.has(qrPayload)) {
      qrPayload = generateQrPayload();
    }

    const now = Timestamp.now();

    const ref = adminDb.collection("attendees").doc();
    const attendeeData: Record<string, unknown> = {
      id: ref.id,
      pin,
      qrPayload,
      name: name.trim(),
      email: normalizedEmail,
      checkedIn: true,
      checkedInAt: now,
      faceDescriptor: null,
      faceConsentGiven: true,
      stampsCollected: [],
      totalFoodRedemptions: 0,
      maxFoodRedemptions: 7,
      walletPassGenerated: false,
      walletPassType: null,
      createdAt: now,
      updatedAt: now,
    };
    if (normalizedPhone) {
      attendeeData.phone = normalizedPhone;
    }

    await ref.set(attendeeData);

    // Log the walk-in registration
    await logAction({
      action: "walkin.created",
      actorId: auth.uid,
      actorName: auth.volunteer?.name || "Volunteer",
      actorRole: auth.volunteer?.role || "volunteer",
      targetId: ref.id,
      targetType: "attendee",
      details: { name: name.trim(), phone: normalizedPhone || undefined },
      severity: "info",
      notifyAdmins: false,
    });

    // Send SMS in background if phone provided
    const passUrl = `${APP_URL}/pass/${qrPayload}`;
    let smsSent = false;
    let smsError = false;
    if (normalizedPhone && isSmsConfigured()) {
      try {
        const result = await sendPassSMS(normalizedPhone, pin, passUrl);
        smsSent = result.success;
        smsError = !result.success;

        if (result.success) {
          await ref.update({ smsSentAt: now });
        }
      } catch {
        smsError = true;
      }
    }

    return NextResponse.json({
      attendee: {
        id: ref.id,
        name: name.trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        pin,
        qrPayload,
        checkedIn: true,
      },
      alreadyExists: false,
      smsSent,
      smsError,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Walk-in registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
