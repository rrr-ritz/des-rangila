import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAuth(request, "volunteer");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const snapshot = await adminDb
    .collection("redemptions")
    .where("attendeeId", "==", params.id)
    .orderBy("timestamp", "desc")
    .get();

  const redemptions = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return NextResponse.json({ redemptions });
}
