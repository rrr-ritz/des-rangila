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

  // Fetch without orderBy/where to avoid composite index requirements; filter + sort in JS.
  const snapshot = await adminDb
    .collection("audit_log")
    .limit(limit)
    .get();

  let entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Filter in JS
  if (action) {
    entries = entries.filter((e) => (e as Record<string, unknown>).action === action);
  }
  if (severity) {
    entries = entries.filter((e) => (e as Record<string, unknown>).severity === severity);
  }

  // Sort by timestamp descending
  entries.sort((a, b) => {
    const aT = (a as Record<string, unknown>).timestamp as { _seconds?: number; seconds?: number } | undefined;
    const bT = (b as Record<string, unknown>).timestamp as { _seconds?: number; seconds?: number } | undefined;
    return (bT?._seconds || bT?.seconds || 0) - (aT?._seconds || aT?.seconds || 0);
  });

  return NextResponse.json({ entries, count: entries.length });
}
