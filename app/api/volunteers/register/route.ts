import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { logAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
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

  // Check if volunteer already exists by UID
  const existingSnapshot = await adminDb
    .collection("volunteers")
    .where("uid", "==", uid)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    return NextResponse.json({
      success: true,
      volunteer: { id: existingSnapshot.docs[0].id, ...existingSnapshot.docs[0].data() },
      existing: true,
    });
  }

  const body = await request.json();

  // Check if volunteer was pre-registered by phone (no UID yet)
  if (body.phone) {
    const digits = String(body.phone).replace(/\D/g, "");
    const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : body.phone;
    const phoneSnapshot = await adminDb
      .collection("volunteers")
      .where("phone", "==", e164)
      .limit(1)
      .get();

    if (!phoneSnapshot.empty) {
      const doc = phoneSnapshot.docs[0];
      // Link the pre-registered volunteer to this Firebase Auth UID
      await doc.ref.update({ uid });
      const data = doc.data();

      await logAction({
        action: "volunteer.linked",
        actorId: uid,
        actorName: data.name || "Volunteer",
        actorRole: "volunteer",
        targetId: doc.id,
        targetType: "volunteer",
        details: { phone: e164 },
        severity: "info",
        notifyAdmins: false,
      });

      return NextResponse.json({
        success: true,
        volunteer: { id: doc.id, ...data, uid },
        existing: true,
      });
    }
  }
  const { name, phone, stationId } = body;

  if (!name || !phone) {
    return NextResponse.json(
      { error: "Name and phone are required" },
      { status: 400 }
    );
  }

  const ref = adminDb.collection("volunteers").doc();
  const volunteer = {
    id: ref.id,
    uid,
    name,
    phone,
    role: "volunteer" as const,
    currentStationId: stationId || null,
    isActive: true,
    createdAt: Timestamp.now(),
  };

  await ref.set(volunteer);

  await logAction({
    action: "volunteer.registered",
    actorId: uid,
    actorName: name,
    actorRole: "volunteer",
    targetId: ref.id,
    targetType: "volunteer",
    details: { phone },
    severity: "info",
    notifyAdmins: false,
  });

  return NextResponse.json({ success: true, volunteer }, { status: 201 });
}
