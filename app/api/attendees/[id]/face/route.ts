import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Volunteer auth — selfie capture happens at check-in station
  try {
    await verifyAuth(request, "volunteer");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const { id } = params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { descriptor, selfieImageBase64 } = body;

  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json(
      { error: "Invalid face descriptor. Must be a 128-element number array." },
      { status: 400 }
    );
  }

  // Validate all values are numbers
  if (!descriptor.every((v: unknown) => typeof v === "number" && !isNaN(v as number))) {
    return NextResponse.json(
      { error: "Face descriptor must contain only numeric values." },
      { status: 400 }
    );
  }

  try {
    const attendeeRef = adminDb.collection("attendees").doc(id);
    const attendeeDoc = await attendeeRef.get();

    if (!attendeeDoc.exists) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }

    // Upload selfie image to Firebase Storage if provided
    let selfieStorageUrl: string | null = null;

    if (selfieImageBase64 && typeof selfieImageBase64 === "string") {
      try {
        const buffer = Buffer.from(selfieImageBase64, "base64");
        const filePath = `selfies/${id}.jpg`;
        const file = adminStorage.bucket().file(filePath);

        await file.save(buffer, {
          contentType: "image/jpeg",
          metadata: {
            cacheControl: "public, max-age=31536000",
          },
        });

        // Make the file publicly accessible and get the URL
        await file.makePublic();
        selfieStorageUrl = `https://storage.googleapis.com/${adminStorage.bucket().name}/${filePath}`;
      } catch (storageErr) {
        // Log but don't fail — the descriptor is more important
        console.error("Selfie image upload error:", storageErr);
      }
    }

    // Update attendee doc with descriptor and optional selfie URL
    const updateData: Record<string, unknown> = {
      faceDescriptor: descriptor,
      faceConsentGiven: true,
    };

    if (selfieStorageUrl) {
      updateData.selfieStorageUrl = selfieStorageUrl;
    }

    await attendeeRef.update(updateData);

    return NextResponse.json({ success: true, selfieUploaded: !!selfieStorageUrl });
  } catch (error) {
    console.error("Face descriptor save error:", error);
    return NextResponse.json(
      { error: "Failed to save face descriptor" },
      { status: 500 }
    );
  }
}
