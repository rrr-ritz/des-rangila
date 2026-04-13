import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

/**
 * GET /api/photos/face-match/queue
 * Get pending face match suggestions for admin review.
 * Enriches each match with the attendee's selfie URL for side-by-side comparison.
 * Query params: status (pending|approved|rejected|all), limit
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

    let query: FirebaseFirestore.Query = adminDb.collection("face_match_queue");

    if (status !== "all") {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();

    // Collect unique attendee IDs to batch-fetch selfie URLs
    const attendeeIds = new Set<string>();
    const rawMatches = snapshot.docs.map((doc) => {
      const data = doc.data();
      if (data.attendeeId) attendeeIds.add(data.attendeeId);
      return { id: doc.id, ...data };
    });

    // Batch-fetch attendee docs for selfie URLs
    const selfieMap: Record<string, string> = {};
    if (attendeeIds.size > 0) {
      const attendeeDocs = await Promise.all(
        Array.from(attendeeIds).map((id) =>
          adminDb.collection("attendees").doc(id).get()
        )
      );
      for (const doc of attendeeDocs) {
        if (doc.exists) {
          const data = doc.data()!;
          if (data.selfieStorageUrl) {
            selfieMap[doc.id] = data.selfieStorageUrl;
          }
        }
      }
    }

    // Enrich matches with selfie URLs and sort by confidence desc
    const matches = rawMatches
      .map((m) => ({
        ...m,
        selfieUrl: selfieMap[(m as Record<string, unknown>).attendeeId as string] || null,
      }))
      .sort((a, b) => {
        const aConf = (a as Record<string, unknown>).confidence as number || 0;
        const bConf = (b as Record<string, unknown>).confidence as number || 0;
        return bConf - aConf;
      });

    // Compute stats for the header
    const allDocs = await adminDb.collection("face_match_queue").get();
    const stats = { autoApproved: 0, pending: 0, rejected: 0, approved: 0 };
    allDocs.docs.forEach((doc) => {
      const s = doc.data().status as string;
      if (s === "auto-approved") stats.autoApproved++;
      else if (s === "pending") stats.pending++;
      else if (s === "rejected") stats.rejected++;
      else if (s === "approved") stats.approved++;
    });

    return NextResponse.json({ matches, total: matches.length, stats });
  } catch (error) {
    console.error("Face match queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch match queue" },
      { status: 500 }
    );
  }
}
