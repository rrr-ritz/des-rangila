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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const startAfter = searchParams.get("startAfter");

  let query = adminDb
    .collection("photos")
    .where("photoType", "==", "booth")
    .orderBy("uploadedAt", "desc")
    .limit(limit + 1);

  if (startAfter) {
    const startDoc = await adminDb.collection("photos").doc(startAfter).get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc);
    }
  }

  const snapshot = await query.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const photos = docs.slice(0, limit).map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return NextResponse.json({ photos, hasMore });
}
