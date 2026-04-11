import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { generatePin, generateQrPayload } from "@/lib/pin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";
import { sendPassSMS, isSmsConfigured } from "@/lib/sms/twilio";

/**
 * POST /api/attendees/walk-in
 * Register a walk-in attendee on the spot.
 * Accepts { name, phone, email? }, generates PIN + QR, creates Firestore doc,
 * sends SMS with PIN + passport link, and returns the created attendee.
 * Requires volunteer or admin auth.
 */
export async function POST(request: NextRequest) {
  let auth;
  try {
    // Allow both volunteers and admins to register walk-ins
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

    if (!phone || typeof phone !== "string" || phone.trim().length < 10) {
      return NextResponse.json(
        { error: "Valid phone number is required" },
        { status: 400 }
      );
    }

    // Normalize phone: strip non-digits, ensure +1 prefix for US numbers
    const digits = phone.replace(/\D/g, "");
    const normalizedPhone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : phone.trim();

    const normalizedEmail = email ? String(email).trim().toLowerCase() : "";

    // Check for duplicate phone
    const existingSnapshot = await adminDb
      .collection("attendees")
      .where("phone", "==", normalizedPhone)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Return the existing attendee instead of creating a duplicate
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      return NextResponse.json({
        attendee: {
          id: existingDoc.id,
          name: existingData.name,
          phone: existingData.phone,
          email: existingData.email,
          pin: existingData.pin,
          qrPayload: existingData.qrPayload,
          checkedIn: existingData.checkedIn,
        },
        alreadyExists: true,
      });
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
    const attendeeData = {
      id: ref.id,
      pin,
      qrPayload,
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
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

    await ref.set(attendeeData);

    // Log the walk-in registration
    await logAction({
      action: "walkin.created",
      actorId: auth.uid,
      actorName: auth.volunteer?.name || "Volunteer",
      actorRole: auth.volunteer?.role || "volunteer",
      targetId: ref.id,
      targetType: "attendee",
      details: { name: name.trim(), phone: normalizedPhone },
      severity: "info",
      notifyAdmins: false,
    });

    // Send SMS with PIN + passport link
    const passUrl = `https://desrangila.ritvik.it/pass/${ref.id}`;
    let smsSent = false;
    let smsError = false;
    if (isSmsConfigured()) {
      try {
        const result = await sendPassSMS(normalizedPhone, pin, passUrl);
        smsSent = result.success;
        smsError = !result.success;

        if (result.success) {
          await ref.update({ smsSentAt: now });
        }
      } catch {
        // SMS failure is non-critical — attendee is still registered
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
