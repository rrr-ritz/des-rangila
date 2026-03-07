import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Public endpoint (attendee portal uses PIN auth at page level)
  const snapshot = await adminDb
    .collection("photos")
    .where("attendeeIds", "array-contains", params.id)
    .where("approved", "==", true)
    .orderBy("takenAt", "desc")
    .get();

  const photos = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return NextResponse.json({ photos });
}
