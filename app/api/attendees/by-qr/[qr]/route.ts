import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { qr: string } }
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
    .collection("attendees")
    .where("qrPayload", "==", params.qr)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const doc = snapshot.docs[0];
  const data = doc.data()!;

  if (data.deactivated) {
    return NextResponse.json(
      { error: "This passport has been deactivated." },
      { status: 403 }
    );
  }

  return NextResponse.json({ id: doc.id, ...data });
}
