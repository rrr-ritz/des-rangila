import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { sendPassEmail, isEmailConfigured } from "@/lib/email/resend";
import { logAction } from "@/lib/audit";

/**
 * POST /api/passes/send/[id]
 * Send the digital passport email to a single attendee.
 * Requires admin auth.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { volunteer } = await verifyAuth(request, "admin");

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "Email service is not configured. Set RESEND_API_KEY." },
        { status: 503 }
      );
    }

    // Get attendee
    const doc = await adminDb.collection("attendees").doc(params.id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Attendee not found" },
        { status: 404 }
      );
    }

    const attendee = doc.data()!;

    if (!attendee.email) {
      return NextResponse.json(
        { error: "Attendee has no email address" },
        { status: 400 }
      );
    }

    // Send the pass email
    const result = await sendPassEmail({
      name: attendee.name || "Attendee",
      email: attendee.email,
      pin: attendee.pin || "",
      qrPayload: attendee.qrPayload || "",
      ticketTier: attendee.ticketTier || "general",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Email send failed" },
        { status: 500 }
      );
    }

    // Mark attendee as pass sent
    await adminDb.collection("attendees").doc(params.id).update({
      passEmailSentAt: new Date().toISOString(),
    });

    // Audit log
    await logAction({
      action: "pass_email_sent",
      actorId: volunteer?.id || "system",
      actorName: volunteer?.name || "Admin",
      actorRole: "admin",
      targetId: params.id,
      targetType: "attendee",
      details: { email: attendee.email },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Send pass email error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
