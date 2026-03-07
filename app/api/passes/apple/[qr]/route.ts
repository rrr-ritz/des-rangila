import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { generateApplePass, isAppleWalletConfigured } from "@/lib/passes/apple";

/**
 * GET /api/passes/apple/[qr]
 * Generate and download a .pkpass file for the attendee.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { qr: string } }
) {
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet is not configured." },
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

    const passBuffer = await generateApplePass({
      qrPayload: params.qr,
      name: attendee.name || "Attendee",
      pin: attendee.pin || "",
      ticketTier: attendee.ticketTier || "general",
      stampsCollected: attendee.stampsCollected || [],
    });

    return new NextResponse(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="des-rangila-pass.pkpass"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Apple pass generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate Apple Wallet pass" },
      { status: 500 }
    );
  }
}
