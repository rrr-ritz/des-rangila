import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// TEMPORARY debug endpoint — remove after fixing face match dashboard
export async function GET() {
  try {
    // Test 1: Raw collection scan
    const allDocs = await adminDb.collection("face_match_queue").limit(20).get();
    const allData = allDocs.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        status: d.status,
        attendeeName: d.attendeeName,
        confidence: d.confidence,
        photoId: d.photoId,
        hasCreatedAt: !!d.createdAt,
        createdAtType: d.createdAt ? typeof d.createdAt : "missing",
        createdAtValue: d.createdAt?._seconds || d.createdAt?.seconds || "none",
      };
    });

    // Test 2: where(status == auto-approved)
    let autoApprovedCount = -1;
    let autoApprovedError = null;
    try {
      const q = await adminDb
        .collection("face_match_queue")
        .where("status", "==", "auto-approved")
        .limit(50)
        .get();
      autoApprovedCount = q.size;
    } catch (e) {
      autoApprovedError = String(e);
    }

    // Test 3: where(status == pending)
    let pendingCount = -1;
    let pendingError = null;
    try {
      const q = await adminDb
        .collection("face_match_queue")
        .where("status", "==", "pending")
        .limit(50)
        .get();
      pendingCount = q.size;
    } catch (e) {
      pendingError = String(e);
    }

    return NextResponse.json({
      totalDocs: allDocs.size,
      allData,
      autoApprovedCount,
      autoApprovedError,
      pendingCount,
      pendingError,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
