import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  // Fetch all photos, sort in JS (no orderBy to avoid index issues)
  const snapshot = await adminDb.collection("photos").get();

  const photos = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const aT = (a as Record<string, unknown>).uploadedAt as { _seconds?: number; seconds?: number } | undefined;
      const bT = (b as Record<string, unknown>).uploadedAt as { _seconds?: number; seconds?: number } | undefined;
      return (bT?._seconds || bT?.seconds || 0) - (aT?._seconds || aT?.seconds || 0);
    });

  return NextResponse.json({ photos, hasMore: false });
}
