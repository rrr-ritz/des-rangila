import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
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
