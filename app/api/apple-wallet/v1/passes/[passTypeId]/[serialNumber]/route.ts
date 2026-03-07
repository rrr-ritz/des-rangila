import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { generateApplePass, isAppleWalletConfigured } from "@/lib/passes/apple";

/**
 * Apple Wallet Web Service - Get Latest Pass
 *
 * GET /api/apple-wallet/v1/passes/{passTypeId}/{serialNumber}
 *   Get the latest version of a pass.
 *   Apple Wallet calls this when it detects an update is available.
 *
 * See: https://developer.apple.com/documentation/walletpasses/send_an_updated_pass
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      passTypeId: string;
      serialNumber: string;
    };
  }
) {
  const { serialNumber } = params;

  // Verify auth token
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return new NextResponse(null, { status: 401 });
  }

  const token = authHeader.replace("ApplePass ", "");
  if (token !== serialNumber) {
    return new NextResponse(null, { status: 401 });
  }

  if (!isAppleWalletConfigured()) {
    return new NextResponse(null, { status: 503 });
  }

  try {
    // Look up attendee by QR payload (serial number)
    const snapshot = await adminDb
      .collection("attendees")
      .where("qrPayload", "==", serialNumber)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return new NextResponse(null, { status: 404 });
    }

    const attendee = snapshot.docs[0].data();

    const passBuffer = await generateApplePass({
      qrPayload: serialNumber,
      name: attendee.name || "Attendee",
      pin: attendee.pin || "",
      stampsCollected: attendee.stampsCollected || [],
    });

    const lastModified = new Date().toUTCString();

    return new NextResponse(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": lastModified,
      },
    });
  } catch (err) {
    console.error("Apple Wallet get pass error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
