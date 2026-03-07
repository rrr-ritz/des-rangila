import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.toLowerCase() || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = adminDb.collection("attendees").orderBy("name").limit(limit);

  if (offset > 0) {
    // Simple offset-based pagination for admin use
    query = query.offset(offset);
  }

  const snapshot = await query.get();
  let attendees = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Client-side search filter (fine for ~200 attendees)
  if (search) {
    attendees = attendees.filter(
      (a: Record<string, unknown>) =>
        (a.name as string)?.toLowerCase().includes(search) ||
        (a.email as string)?.toLowerCase().includes(search) ||
        (a.pin as string)?.includes(search)
    );
  }

  return NextResponse.json({ attendees, count: attendees.length });
}
