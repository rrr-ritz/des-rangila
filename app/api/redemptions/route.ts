import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  let authResult;
  try {
    authResult = await verifyAuth(request, "volunteer");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { attendeeId, stationId, itemType, idempotencyKey, syncedFromOffline } =
    body;

  if (!attendeeId || !stationId || !itemType || !idempotencyKey) {
    return NextResponse.json(
      { error: "Missing required fields: attendeeId, stationId, itemType, idempotencyKey" },
      { status: 400 }
    );
  }

  try {
  // Idempotency check: if this key already exists, return success without duplicating
  const existingSnapshot = await adminDb
    .collection("redemptions")
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      id: existingSnapshot.docs[0].id,
    });
  }

  // Run as a transaction to ensure consistency
  const result = await adminDb.runTransaction(async (tx) => {
    // Get attendee
    const attendeeRef = adminDb.collection("attendees").doc(attendeeId);
    const attendeeDoc = await tx.get(attendeeRef);
    if (!attendeeDoc.exists) {
      throw new Error("Attendee not found");
    }
    const attendee = attendeeDoc.data()!;

    // Get station
    const stationRef = adminDb.collection("stations").doc(stationId);
    const stationDoc = await tx.get(stationRef);
    if (!stationDoc.exists) {
      throw new Error("Station not found");
    }
    const station = stationDoc.data()!;

    // Check if already redeemed at this station for this item type
    const existingRedemption = await adminDb
      .collection("redemptions")
      .where("attendeeId", "==", attendeeId)
      .where("stationId", "==", stationId)
      .where("itemType", "==", itemType)
      .limit(1)
      .get();

    if (!existingRedemption.empty) {
      throw new Error("Already redeemed at this station");
    }

    // Check food limit for food items
    if (
      itemType !== "activity" &&
      attendee.totalFoodRedemptions >= attendee.maxFoodRedemptions
    ) {
      throw new Error(
        `Food limit reached (${attendee.totalFoodRedemptions}/${attendee.maxFoodRedemptions})`
      );
    }

    // Check inventory for food items
    if (itemType !== "activity") {
      const inventorySnapshot = await adminDb
        .collection("inventory")
        .where("stationId", "==", stationId)
        .limit(1)
        .get();

      if (!inventorySnapshot.empty) {
        const inv = inventorySnapshot.docs[0];
        const invData = inv.data();
        if (invData.remainingCount <= 0) {
          throw new Error(`${invData.itemName} is sold out`);
        }
        // Decrement inventory
        tx.update(inv.ref, {
          remainingCount: FieldValue.increment(-1),
          ...(invData.remainingCount - 1 === 0
            ? { depletedAt: Timestamp.now() }
            : {}),
        });

        // Check low stock
        const newCount = invData.remainingCount - 1;
        if (newCount <= invData.lowStockThreshold && newCount > 0) {
          // Log low stock warning (outside transaction)
          setTimeout(() => {
            logAction({
              action: "inventory.low_stock",
              actorId: "system",
              actorName: "System",
              actorRole: "system",
              targetId: inv.id,
              targetType: "inventory",
              details: {
                stationId,
                itemName: invData.itemName,
                remaining: newCount,
                threshold: invData.lowStockThreshold,
              },
              severity: "warning",
              notifyAdmins: true,
            });
          }, 0);
        } else if (newCount === 0) {
          setTimeout(() => {
            logAction({
              action: "inventory.depleted",
              actorId: "system",
              actorName: "System",
              actorRole: "system",
              targetId: inv.id,
              targetType: "inventory",
              details: { stationId, itemName: invData.itemName },
              severity: "error",
              notifyAdmins: true,
            });
          }, 0);
        }
      }
    }

    // Create redemption
    const redemptionRef = adminDb.collection("redemptions").doc();
    const volunteer = authResult.volunteer;
    tx.set(redemptionRef, {
      id: redemptionRef.id,
      attendeeId,
      attendeeName: attendee.name,
      stationId,
      stationName: station.name,
      itemType,
      volunteerId: volunteer?.id || authResult.uid,
      volunteerName: volunteer?.name || "Volunteer",
      timestamp: Timestamp.now(),
      syncedFromOffline: syncedFromOffline || false,
      idempotencyKey,
    });

    // Update attendee: add stamp and increment food count
    const updates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (!attendee.stampsCollected?.includes(stationId)) {
      updates.stampsCollected = FieldValue.arrayUnion(stationId);
    }

    if (itemType !== "activity") {
      updates.totalFoodRedemptions = FieldValue.increment(1);
    }

    tx.update(attendeeRef, updates);

    return { id: redemptionRef.id };
  });

  await logAction({
    action: "redemption.created",
    actorId: authResult.volunteer?.id || authResult.uid,
    actorName: authResult.volunteer?.name || "Volunteer",
    actorRole: "volunteer",
    targetId: attendeeId,
    targetType: "attendee",
    details: { stationId, itemType, redemptionId: result.id },
    severity: "info",
  });

  return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Redemption failed";
    // Known validation errors return 409
    const isValidation = [
      "Attendee not found",
      "Station not found",
      "Already redeemed",
      "Food limit reached",
      "sold out",
    ].some((m) => message.includes(m));
    return NextResponse.json(
      { error: message },
      { status: isValidation ? 409 : 500 }
    );
  }
}
