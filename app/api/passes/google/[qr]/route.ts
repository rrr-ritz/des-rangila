import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  generateSaveUrl,
  isGoogleWalletConfigured,
  createWalletObject,
} from "@/lib/passes/google";

/**
 * GET /api/passes/google/[qr]
 * Generate a Google Wallet save URL and redirect the user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { qr: string } }
) {
  if (!isGoogleWalletConfigured()) {
    return NextResponse.json(
      { error: "Google Wallet is not configured." },
      { status: 503 }
    );
  }

  try {
    // Look up attendee by QR payload
    const snapshot = await adminDb
      .collection("attendees")
      .where("qrPayload", "==", params.qr)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Attendee not found" },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const attendee = doc.data();

    if (attendee.deactivated) {
      return NextResponse.json(
        { error: "This passport has been deactivated." },
        { status: 403 }
      );
    }

    const passData = {
      qrPayload: params.qr,
      name: attendee.name || "Attendee",
      pin: attendee.pin || "",
      stampsCollected: attendee.stampsCollected || [],
    };

    // Create or update the wallet object via the API
    try {
      await createWalletObject(passData);
    } catch {
      // If API call fails, the JWT save URL will still create the object
      console.warn("Could not pre-create wallet object, using JWT fallback");
    }

    // Generate the signed JWT save URL
    const saveUrl = generateSaveUrl(passData);

    // Redirect the user to the Google Wallet save page
    return NextResponse.redirect(saveUrl);
  } catch (err) {
    console.error("Google Wallet pass error:", err);
    return NextResponse.json(
      { error: "Failed to generate Google Wallet pass" },
      { status: 500 }
    );
  }
}
