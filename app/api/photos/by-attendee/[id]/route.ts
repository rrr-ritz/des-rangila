import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Public endpoint (attendee portal uses PIN auth at page level)
  // Single where() to avoid composite index requirement; filter + sort in JS.
  const snapshot = await adminDb
    .collection("photos")
    .where("attendeeIds", "array-contains", params.id)
    .get();

  const photos = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => (p as Record<string, unknown>).approved === true)
    .sort((a, b) => {
      const aT = (a as Record<string, unknown>).takenAt as { _seconds?: number; seconds?: number } | undefined;
      const bT = (b as Record<string, unknown>).takenAt as { _seconds?: number; seconds?: number } | undefined;
      return (bT?._seconds || bT?.seconds || 0) - (aT?._seconds || aT?.seconds || 0);
    });

  return NextResponse.json({ photos });
}
