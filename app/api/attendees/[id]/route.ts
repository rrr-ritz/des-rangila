import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(
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

  const doc = await adminDb.collection("attendees").doc(params.id).get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  return NextResponse.json({ id: doc.id, ...doc.data() });
}
