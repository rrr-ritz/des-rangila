import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Apple Wallet Web Service - Device Registration
 *
 * POST /api/apple-wallet/v1/devices/{deviceId}/registrations/{passTypeId}/{serialNumber}
 *   Register a device for push notifications for a pass.
 *
 * DELETE /api/apple-wallet/v1/devices/{deviceId}/registrations/{passTypeId}/{serialNumber}
 *   Unregister a device from push notifications for a pass.
 *
 * See: https://developer.apple.com/documentation/walletpasses/register_a_pass_for_update_notifications
 */

function verifyAuthToken(
  request: NextRequest,
  serialNumber: string
): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  // Apple sends: "ApplePass <authenticationToken>"
  const token = authHeader.replace("ApplePass ", "");
  // We use qrPayload as the auth token (set in pass generation)
  return token === serialNumber;
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      deviceId: string;
      passTypeId: string;
      serialNumber: string;
    };
  }
) {
  const { deviceId, passTypeId, serialNumber } = params;

  if (!verifyAuthToken(request, serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    let pushToken = "";
    try {
      const body = await request.json();
      pushToken = body.pushToken || "";
    } catch {
      // Body may be empty
    }

    const registrationId = `${deviceId}_${passTypeId}_${serialNumber}`;

    // Check if registration already exists
    const existing = await adminDb
      .collection("apple_wallet_registrations")
      .doc(registrationId)
      .get();

    if (existing.exists) {
      // Already registered — 200 OK
      return new NextResponse(null, { status: 200 });
    }

    // Create new registration — 201 Created
    await adminDb
      .collection("apple_wallet_registrations")
      .doc(registrationId)
      .set({
        deviceId,
        passTypeId,
        serialNumber,
        pushToken,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

    return new NextResponse(null, { status: 201 });
  } catch (err) {
    console.error("Apple Wallet register error:", err);
    return new NextResponse(null, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      deviceId: string;
      passTypeId: string;
      serialNumber: string;
    };
  }
) {
  const { deviceId, passTypeId, serialNumber } = params;

  if (!verifyAuthToken(request, serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const registrationId = `${deviceId}_${passTypeId}_${serialNumber}`;
    await adminDb
      .collection("apple_wallet_registrations")
      .doc(registrationId)
      .delete();

    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("Apple Wallet unregister error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
