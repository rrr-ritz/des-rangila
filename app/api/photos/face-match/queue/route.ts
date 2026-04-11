import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

/**
 * GET /api/photos/face-match/queue
 * Get pending face match suggestions for admin review.
 * Query params: status (pending|approved|rejected), limit
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    // Simple query — no orderBy to avoid composite index requirement.
    // Sort client-side instead (collection is small).
    let query: FirebaseFirestore.Query = adminDb.collection("face_match_queue");

    if (status !== "all") {
      query = query.where("status", "==", status);
    }

    if (limit > 0) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    const matches = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = (a as Record<string, unknown>).createdAt as { _seconds?: number; seconds?: number } | undefined;
        const bTime = (b as Record<string, unknown>).createdAt as { _seconds?: number; seconds?: number } | undefined;
        return (bTime?._seconds || bTime?.seconds || 0) - (aTime?._seconds || aTime?.seconds || 0);
      });

    return NextResponse.json({ matches, total: matches.length });
  } catch (error) {
    console.error("Face match queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch match queue" },
      { status: 500 }
    );
  }
}
