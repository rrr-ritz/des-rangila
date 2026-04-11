import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";

/**
 * POST /api/dev-login
 * Bypasses Firebase phone auth by issuing a custom token for any
 * registered volunteer. Used because Twilio SMS is blocked (toll-free
 * IN_REVIEW) so Firebase phone auth can't send verification codes.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const phone = body.phone;

  if (!phone) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }

  // Normalize phone: strip non-digits, add +1 if 10 digits
  const digits = phone.replace(/\D/g, "");
  const candidates = [
    phone,
    `+1${digits}`,
    `+${digits}`,
    digits,
  ];

  // Find volunteer by any phone format
  let matchedDoc = null;
  const allVols = await adminDb.collection("volunteers").get();
  for (const doc of allVols.docs) {
    const volPhone = doc.data().phone || "";
    const volDigits = volPhone.replace(/\D/g, "");
    if (candidates.includes(volPhone) || candidates.includes(volDigits) || digits === volDigits) {
      matchedDoc = doc;
      break;
    }
  }

  if (!matchedDoc) {
    return NextResponse.json(
      { error: "No volunteer found with this phone number" },
      { status: 404 }
    );
  }

  const data = matchedDoc.data();

  // Use a stable UID so it links consistently
  const stableUid = `volunteer-${matchedDoc.id}`;

  // Create or update the volunteer's UID
  if (data.uid !== stableUid) {
    await matchedDoc.ref.update({ uid: stableUid });
  }

  // Create a custom token for this UID
  const customToken = await adminAuth.createCustomToken(stableUid);

  return NextResponse.json({ customToken, volunteerId: matchedDoc.id });
}
