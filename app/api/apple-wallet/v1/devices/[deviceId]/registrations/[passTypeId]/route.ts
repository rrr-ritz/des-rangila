import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Apple Wallet Web Service - Get Updatable Passes
 *
 * GET /api/apple-wallet/v1/devices/{deviceId}/registrations/{passTypeId}
 *   Get the serial numbers of passes registered for a device.
 *   Optional query: ?passesUpdatedSince=<tag>
 *
 * Returns:
 *   200 with { serialNumbers, lastUpdated } if passes need updating
 *   204 if no updates
 *
 * See: https://developer.apple.com/documentation/walletpasses/get_the_list_of_updatable_passes
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      deviceId: string;
      passTypeId: string;
    };
  }
) {
  const { deviceId, passTypeId } = params;
  const { searchParams } = new URL(request.url);
  const passesUpdatedSince = searchParams.get("passesUpdatedSince");

  try {
    // Find all registrations for this device; filter passTypeId in JS
    // to avoid composite index requirement.
    const snapshot = await adminDb
      .collection("apple_wallet_registrations")
      .where("deviceId", "==", deviceId)
      .get();

    const matchingDocs = snapshot.docs.filter(
      (doc) => doc.data().passTypeId === passTypeId
    );

    if (matchingDocs.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const serialNumbers = matchingDocs.map(
      (doc) => doc.data().serialNumber as string
    );

    // If passesUpdatedSince is provided, filter to only passes updated since that time
    if (passesUpdatedSince) {
      const sinceTimestamp = parseFloat(passesUpdatedSince);
      if (!isNaN(sinceTimestamp)) {
        // Check which attendees have been updated since the given timestamp
        const updatedSerials: string[] = [];

        for (const serial of serialNumbers) {
          const attendeeSnap = await adminDb
            .collection("attendees")
            .where("qrPayload", "==", serial)
            .limit(1)
            .get();

          if (!attendeeSnap.empty) {
            const data = attendeeSnap.docs[0].data();
            const updatedAt = data.updatedAt;
            if (updatedAt) {
              const updateTime =
                updatedAt._seconds || updatedAt.seconds || 0;
              if (updateTime > sinceTimestamp) {
                updatedSerials.push(serial);
              }
            }
          }
        }

        if (updatedSerials.length === 0) {
          return new NextResponse(null, { status: 204 });
        }

        return NextResponse.json({
          serialNumbers: updatedSerials,
          lastUpdated: String(Math.floor(Date.now() / 1000)),
        });
      }
    }

    return NextResponse.json({
      serialNumbers,
      lastUpdated: String(Math.floor(Date.now() / 1000)),
    });
  } catch (err) {
    console.error("Apple Wallet list passes error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
