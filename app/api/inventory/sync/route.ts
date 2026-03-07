import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request, "volunteer");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const snapshot = await adminDb.collection("inventory").get();
  const items = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      stationId: d.stationId,
      itemName: d.itemName,
      itemType: d.itemType,
      remainingCount: d.remainingCount,
      initialCount: d.initialCount,
    };
  });

  return NextResponse.json({ items });
}
