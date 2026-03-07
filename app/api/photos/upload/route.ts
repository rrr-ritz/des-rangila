import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const stripFile = formData.get("strip") as File | null;
    const thumbnailFile = formData.get("thumbnail") as File | null;
    const attendeeIdsRaw = formData.get("attendeeIds") as string | null;
    const photoType = (formData.get("photoType") as string) || "booth";

    if (!stripFile) {
      return NextResponse.json({ error: "No strip image provided" }, { status: 400 });
    }

    const attendeeIds: string[] = attendeeIdsRaw
      ? JSON.parse(attendeeIdsRaw)
      : [];

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const baseFilename = `booth_${timestamp}_${randomSuffix}`;

    const bucket = adminStorage.bucket();

    // Upload strip
    const stripBuffer = Buffer.from(await stripFile.arrayBuffer());
    const stripPath = `photos/booth/${baseFilename}.jpg`;
    const stripFileRef = bucket.file(stripPath);
    await stripFileRef.save(stripBuffer, {
      metadata: { contentType: "image/jpeg" },
    });
    await stripFileRef.makePublic();
    const stripUrl = `https://storage.googleapis.com/${bucket.name}/${stripPath}`;

    // Upload thumbnail
    let thumbnailUrl = stripUrl;
    if (thumbnailFile) {
      const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
      const thumbPath = `photos/booth/thumbs/${baseFilename}_thumb.jpg`;
      const thumbFileRef = bucket.file(thumbPath);
      await thumbFileRef.save(thumbBuffer, {
        metadata: { contentType: "image/jpeg" },
      });
      await thumbFileRef.makePublic();
      thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${thumbPath}`;
    }

    // Upload individual photos
    const individualPhotos: string[] = [];
    for (let i = 0; i < 4; i++) {
      const photoFile = formData.get(`photo_${i}`) as File | null;
      if (!photoFile) break;
      const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
      const photoPath = `photos/booth/individual/${baseFilename}_${i}.jpg`;
      const photoFileRef = bucket.file(photoPath);
      await photoFileRef.save(photoBuffer, {
        metadata: { contentType: "image/jpeg" },
      });
      await photoFileRef.makePublic();
      individualPhotos.push(
        `https://storage.googleapis.com/${bucket.name}/${photoPath}`
      );
    }

    // Create Firestore document
    const photoDoc = {
      attendeeIds,
      stationId: null,
      photoType,
      storageUrl: stripUrl,
      thumbnailUrl,
      stripUrl: stripUrl,
      width: 660,
      height: 0, // Will be calculated by strip compositor
      takenAt: FieldValue.serverTimestamp(),
      uploadedAt: FieldValue.serverTimestamp(),
      faceMatchConfidence: null,
      approved: true, // Booth photos auto-approved
      individualPhotos,
    };

    const docRef = await adminDb.collection("photos").add(photoDoc);

    return NextResponse.json({
      id: docRef.id,
      stripUrl,
      thumbnailUrl,
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload photos" },
      { status: 500 }
    );
  }
}
