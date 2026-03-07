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
  const action = searchParams.get("action");
  const severity = searchParams.get("severity");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

  let query = adminDb
    .collection("audit_log")
    .orderBy("timestamp", "desc") as FirebaseFirestore.Query;

  if (action) {
    query = query.where("action", "==", action);
  }
  if (severity) {
    query = query.where("severity", "==", severity);
  }

  query = query.limit(limit);

  const snapshot = await query.get();
  const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json({ entries, count: entries.length });
}
