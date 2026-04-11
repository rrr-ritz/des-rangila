import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const snapshot = await adminDb
    .collection("volunteers")
    .where("uid", "==", uid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  return NextResponse.json({
    id: doc.id,
    name: data.name,
    phone: data.phone,
    role: data.role,
    currentStationId: data.currentStationId,
    isActive: data.isActive,
  });
}
