import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { sendPostEventEmail, isEmailConfigured } from "@/lib/email/resend";
import { logAction } from "@/lib/audit";

/**
 * POST /api/email/post-event
 * Send post-event memories emails to attendees.
 * Requires admin auth.
 *
 * Body (optional):
 *   - attendeeIds: string[] — specific attendees to email (omit for all checked-in)
 *   - dryRun: boolean — if true, just return the count
 */
export async function POST(request: NextRequest) {
  try {
    const { volunteer } = await verifyAuth(request, "admin");

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "Email service is not configured. Set RESEND_API_KEY." },
        { status: 503 }
      );
    }

    let attendeeIds: string[] | null = null;
    let dryRun = false;

    try {
      const body = await request.json();
      attendeeIds = body.attendeeIds || null;
      dryRun = body.dryRun || false;
    } catch {
      // No body is fine — send to all checked-in attendees
    }

    let attendees: Array<Record<string, unknown>>;

    if (attendeeIds && attendeeIds.length > 0) {
      // Fetch specific attendees
      const docs = await Promise.all(
        attendeeIds.map((id) =>
          adminDb.collection("attendees").doc(id).get()
        )
      );
      attendees = docs
        .filter((doc) => doc.exists)
        .map((doc) => ({ id: doc.id, ...doc.data() }));
    } else {
      // Fetch all checked-in attendees with email addresses
      const snapshot = await adminDb
        .collection("attendees")
        .where("checkedIn", "==", true)
        .get();
      attendees = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    // Filter to attendees with email addresses
    attendees = attendees.filter((a) => a.email);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        count: attendees.length,
        message: `Would send ${attendees.length} post-event email(s).`,
      });
    }

    // Send emails in batches of 5
    let sent = 0;
    let failed = 0;
    const errors: Array<{ id: string; email: string; error: string }> = [];

    for (let i = 0; i < attendees.length; i += 5) {
      const batch = attendees.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (attendee) => {
          const result = await sendPostEventEmail({
            name: (attendee.name as string) || "Attendee",
            email: attendee.email as string,
            pin: (attendee.pin as string) || "",
            stampsCollected: (attendee.stampsCollected as string[]) || [],
          });

          if (result.success) {
            // Mark as post-event email sent
            await adminDb
              .collection("attendees")
              .doc(attendee.id as string)
              .update({
                postEventEmailSentAt: new Date().toISOString(),
              });
          }

          return { attendee, result };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.result.success) {
          sent++;
        } else {
          failed++;
          const a =
            result.status === "fulfilled"
              ? result.value.attendee
              : { id: "unknown", email: "unknown" };
          const err =
            result.status === "fulfilled"
              ? result.value.result.error || "Unknown error"
              : (result.reason as Error)?.message || "Unknown error";
          errors.push({
            id: a.id as string,
            email: a.email as string,
            error: err,
          });
        }
      }

      // Small delay between batches
      if (i + 5 < attendees.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Audit log
    await logAction({
      action: "post_event_email_sent",
      actorId: volunteer?.id || "system",
      actorName: volunteer?.name || "Admin",
      actorRole: "admin",
      details: { sent, failed, total: attendees.length },
      severity: failed > 0 ? "warning" : "info",
    });

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: attendees.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("Post-event email error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
