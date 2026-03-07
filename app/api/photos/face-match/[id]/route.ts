import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

/**
 * PATCH /api/photos/face-match/[id]
 * Approve or reject a face match suggestion.
 * Body: { action: "approve" | "reject" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let authResult;
  try {
    authResult = await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const { id } = params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  try {
    const matchRef = adminDb.collection("face_match_queue").doc(id);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const matchData = matchDoc.data()!;

    if (matchData.status !== "pending") {
      return NextResponse.json(
        { error: `Match already ${matchData.status}` },
        { status: 409 }
      );
    }

    // Update match status
    await matchRef.update({
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: authResult.uid,
    });

    // If approved, link the photo to the attendee
    if (action === "approve") {
      const photoRef = adminDb.collection("photos").doc(matchData.photoId);
      const photoDoc = await photoRef.get();

      if (photoDoc.exists) {
        const currentAttendeeIds = photoDoc.data()!.attendeeIds || [];
        if (!currentAttendeeIds.includes(matchData.attendeeId)) {
          await photoRef.update({
            attendeeIds: FieldValue.arrayUnion(matchData.attendeeId),
            faceMatchConfidence: matchData.confidence,
          });
        }
      }

      await logAction({
        action: "photo.uploaded",
        actorId: authResult.uid,
        actorName: "Admin",
        actorRole: "admin",
        targetId: matchData.attendeeId,
        targetType: "attendee",
        details: {
          photoId: matchData.photoId,
          confidence: matchData.confidence,
          matchId: id,
        },
        severity: "info",
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Face match review error:", error);
    return NextResponse.json(
      { error: "Failed to update match" },
      { status: 500 }
    );
  }
}
