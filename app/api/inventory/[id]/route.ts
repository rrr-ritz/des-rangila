import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

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

  const body = await request.json();
  const { remainingCount } = body;

  if (typeof remainingCount !== "number" || remainingCount < 0) {
    return NextResponse.json(
      { error: "remainingCount must be a non-negative number" },
      { status: 400 }
    );
  }

  const ref = adminDb.collection("inventory").doc(params.id);
  const doc = await ref.get();

  if (!doc.exists) {
    return NextResponse.json(
      { error: "Inventory item not found" },
      { status: 404 }
    );
  }

  await ref.update({
    remainingCount,
    ...(remainingCount === 0 ? { depletedAt: Timestamp.now() } : { depletedAt: null }),
  });

  return NextResponse.json({ success: true });
}
