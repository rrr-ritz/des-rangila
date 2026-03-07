import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
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

  const { descriptor } = body;

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

    await attendeeRef.update({
      faceDescriptor: descriptor,
      faceConsentGiven: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Face descriptor save error:", error);
    return NextResponse.json(
      { error: "Failed to save face descriptor" },
      { status: 500 }
    );
  }
}
