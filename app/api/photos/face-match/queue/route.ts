import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

/**
 * GET /api/photos/face-match/queue
 * Get face match suggestions for admin review.
 * Enriches each match with the attendee's selfie URL for side-by-side comparison.
 * Query params: status (pending|approved|rejected|all)
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

    // Single fetch of all docs — compute stats + filter in JS
    const snapshot = await adminDb.collection("face_match_queue").get();

    const stats = { autoApproved: 0, pending: 0, rejected: 0, approved: 0 };
    const attendeeIds = new Set<string>();
    const allDocs = snapshot.docs.map((doc) => {
      const data = doc.data();
      const s = data.status as string;
      if (s === "auto-approved") stats.autoApproved++;
      else if (s === "pending") stats.pending++;
      else if (s === "rejected") stats.rejected++;
      else if (s === "approved") stats.approved++;
      if (data.attendeeId) attendeeIds.add(data.attendeeId as string);
      return { id: doc.id, ...data };
    });

    // Filter by requested status
    const filtered = status === "all"
      ? allDocs
      : allDocs.filter((m) => (m as Record<string, unknown>).status === status);

    // Batch-fetch attendee selfie URLs (only for visible matches)
    const visibleAttendeeIds = new Set<string>();
    filtered.forEach((m) => {
      const aid = (m as Record<string, unknown>).attendeeId as string;
      if (aid) visibleAttendeeIds.add(aid);
    });

    const selfieMap: Record<string, string> = {};
    if (visibleAttendeeIds.size > 0) {
      const attendeeDocs = await Promise.all(
        Array.from(visibleAttendeeIds).map((id) =>
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

    // Enrich and sort by confidence descending
    const matches = filtered
      .map((m) => ({
        ...m,
        selfieUrl: selfieMap[(m as Record<string, unknown>).attendeeId as string] || null,
      }))
      .sort((a, b) => {
        const aConf = (a as Record<string, unknown>).confidence as number || 0;
        const bConf = (b as Record<string, unknown>).confidence as number || 0;
        return bConf - aConf;
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
