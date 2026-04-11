import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAuth(request, "volunteer");
  } catch {
    try {
      await verifyAuth(request, "admin");
    } catch (e2) {
      if (e2 instanceof AuthError) {
        return NextResponse.json({ error: e2.message }, { status: e2.status });
      }
      throw e2;
    }
  }

  const snapshot = await adminDb
    .collection("redemptions")
    .where("attendeeId", "==", params.id)
    .get();

  const redemptions = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const aT = (a as Record<string, unknown>).timestamp as { _seconds?: number; seconds?: number } | undefined;
      const bT = (b as Record<string, unknown>).timestamp as { _seconds?: number; seconds?: number } | undefined;
      return (bT?._seconds || bT?.seconds || 0) - (aT?._seconds || aT?.seconds || 0);
    });

  return NextResponse.json({ redemptions });
}
