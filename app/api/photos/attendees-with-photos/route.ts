import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

/**
 * GET /api/photos/attendees-with-photos
 * Returns attendees who have at least 1 matched photo, with their selfie URL
 * and photo count, sorted alphabetically. Used by the Attendee Preview tab.
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
    // Fetch all photos, tally attendeeIds
    const photosSnapshot = await adminDb.collection("photos").get();
    const photoCounts = new Map<string, number>();

    photosSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.approved !== true) return;
      const ids = (data.attendeeIds as string[]) || [];
      for (const id of ids) {
        photoCounts.set(id, (photoCounts.get(id) || 0) + 1);
      }
    });

    if (photoCounts.size === 0) {
      return NextResponse.json({ attendees: [] });
    }

    // Batch-fetch attendee docs
    const attendeeDocs = await Promise.all(
      Array.from(photoCounts.keys()).map((id) =>
        adminDb.collection("attendees").doc(id).get()
      )
    );

    const attendees = attendeeDocs
      .filter((d) => d.exists)
      .map((d) => {
        const data = d.data()!;
        return {
          id: d.id,
          name: (data.name as string) || "Unknown",
          selfieUrl: (data.selfieStorageUrl as string) || null,
          photoCount: photoCounts.get(d.id) || 0,
        };
      })
      .filter((a) => a.selfieUrl !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ attendees });
  } catch (error) {
    console.error("Attendees-with-photos error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendees" },
      { status: 500 }
    );
  }
}
