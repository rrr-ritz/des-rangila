import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

/**
 * POST /api/photos/face-match
 * Trigger face recognition batch job.
 * Takes unprocessed photos, detects faces client-side, and matches
 * against stored attendee descriptors.
 *
 * Body: { photoId: string, faces: Array<{ descriptor: number[], box: {...} }> }
 *
 * The actual face detection runs client-side (in the admin browser),
 * and results are sent here for matching against attendee descriptors.
 */
export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { photoId, faces } = body;

  if (!photoId || !Array.isArray(faces)) {
    return NextResponse.json(
      { error: "Missing photoId or faces array" },
      { status: 400 }
    );
  }

  try {
    // Get photo document
    const photoDoc = await adminDb.collection("photos").doc(photoId).get();
    if (!photoDoc.exists) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Get all attendees with face descriptors
    const attendeesSnapshot = await adminDb
      .collection("attendees")
      .where("faceConsentGiven", "==", true)
      .get();

    const attendeeDescriptors = attendeesSnapshot.docs
      .filter((doc) => doc.data().faceDescriptor)
      .map((doc) => ({
        attendeeId: doc.id,
        attendeeName: doc.data().name,
        descriptor: doc.data().faceDescriptor as number[],
      }));

    if (attendeeDescriptors.length === 0) {
      return NextResponse.json({
        matches: 0,
        message: "No attendees with face descriptors found",
      });
    }

    // Match each detected face against attendee descriptors
    const THRESHOLD = 0.6;
    let matchCount = 0;
    const batch = adminDb.batch();

    for (const face of faces) {
      const faceDesc = new Float32Array(face.descriptor);

      for (const attendee of attendeeDescriptors) {
        const attendeeDesc = new Float32Array(attendee.descriptor);

        // Euclidean distance
        let sum = 0;
        for (let i = 0; i < 128; i++) {
          const diff = faceDesc[i] - attendeeDesc[i];
          sum += diff * diff;
        }
        const distance = Math.sqrt(sum);

        if (distance < THRESHOLD) {
          // Create match suggestion
          const matchRef = adminDb.collection("face_match_queue").doc();
          batch.set(matchRef, {
            id: matchRef.id,
            photoId,
            photoUrl: photoDoc.data()!.storageUrl,
            attendeeId: attendee.attendeeId,
            attendeeName: attendee.attendeeName,
            distance,
            confidence: Math.round((1 - distance / THRESHOLD) * 100),
            faceBox: face.box,
            status: "pending", // pending | approved | rejected
            createdAt: FieldValue.serverTimestamp(),
            reviewedAt: null,
            reviewedBy: null,
          });
          matchCount++;
        }
      }
    }

    if (matchCount > 0) {
      await batch.commit();
    }

    // Mark photo as processed
    await adminDb.collection("photos").doc(photoId).update({
      faceMatchProcessed: true,
      faceMatchCount: matchCount,
    });

    return NextResponse.json({
      matches: matchCount,
      totalFaces: faces.length,
      totalAttendees: attendeeDescriptors.length,
    });
  } catch (error) {
    console.error("Face match error:", error);
    return NextResponse.json(
      { error: "Face matching failed" },
      { status: 500 }
    );
  }
}
