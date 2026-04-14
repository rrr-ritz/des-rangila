import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

/**
 * PATCH /api/photos/[id]/unlink
 * Remove a specific attendee from a photo's attendeeIds array.
 * Body: { attendeeId: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAuth(request, "admin");
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

  const { attendeeId } = body;
  if (!attendeeId || typeof attendeeId !== "string") {
    return NextResponse.json(
      { error: "attendeeId is required" },
      { status: 400 }
    );
  }

  try {
    const photoRef = adminDb.collection("photos").doc(params.id);
    const photoDoc = await photoRef.get();
    if (!photoDoc.exists) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    await photoRef.update({
      attendeeIds: FieldValue.arrayRemove(attendeeId),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unlink photo error:", error);
    return NextResponse.json(
      { error: "Failed to unlink attendee from photo" },
      { status: 500 }
    );
  }
}
