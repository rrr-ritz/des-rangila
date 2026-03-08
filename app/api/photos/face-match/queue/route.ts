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

    let query: FirebaseFirestore.Query = adminDb
      .collection("face_match_queue")
      .orderBy("createdAt", "desc");

    // Support "all" to fetch all statuses (for admin overview)
    if (status !== "all") {
      query = query.where("status", "==", status);
    }

    if (limit > 0) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    const matches = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ matches, total: matches.length });
  } catch (error) {
    console.error("Face match queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch match queue" },
      { status: 500 }
    );
  }
}
