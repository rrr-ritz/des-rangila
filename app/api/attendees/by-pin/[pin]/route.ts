import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// Rate limiting: simple in-memory store (sufficient for ~200 users)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count++;
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { pin: string } }
) {
  // Rate limit: 5 requests per minute per IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  const { pin } = params;

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
  }

  const snapshot = await adminDb
    .collection("attendees")
    .where("pin", "==", pin)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  if (data.deactivated) {
    return NextResponse.json(
      { error: "This passport has been deactivated." },
      { status: 403 }
    );
  }

  // Return only non-sensitive fields for public PIN lookup
  return NextResponse.json({
    id: doc.id,
    name: data.name,
    checkedIn: data.checkedIn,
    stampsCollected: data.stampsCollected,
    totalFoodRedemptions: data.totalFoodRedemptions,
    maxFoodRedemptions: data.maxFoodRedemptions,
    walletPassGenerated: data.walletPassGenerated,
  });
}
