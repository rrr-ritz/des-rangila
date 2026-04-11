import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";

const DEV_PHONE = "+11111111111";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.phone !== DEV_PHONE) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // Find the dev volunteer doc
  const snapshot = await adminDb
    .collection("volunteers")
    .where("phone", "==", DEV_PHONE)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return NextResponse.json(
      { error: "Dev volunteer not found in Firestore" },
      { status: 404 }
    );
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  // Use a stable UID for the dev account so it links consistently
  const devUid = `dev-volunteer-${doc.id}`;

  // Create or update the volunteer's UID
  if (data.uid !== devUid) {
    await doc.ref.update({ uid: devUid });
  }

  // Create a custom token for this UID
  const customToken = await adminAuth.createCustomToken(devUid);

  return NextResponse.json({ customToken, volunteerId: doc.id });
}
