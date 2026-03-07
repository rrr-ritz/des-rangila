import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { sendPassEmail, isEmailConfigured } from "@/lib/email/resend";
import { logAction } from "@/lib/audit";

/**
 * POST /api/passes/send-all
 * Send digital passport emails to all attendees who haven't received one.
 * Requires admin auth.
 *
 * Query params:
 *   - force=true: resend to ALL attendees, even those already sent
 *   - dryRun=true: return the count without sending
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

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const dryRun = searchParams.get("dryRun") === "true";

    // Get all attendees with email addresses
    const snapshot = await adminDb.collection("attendees").get();
    const attendees = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (a: Record<string, unknown>) =>
          a.email && (force || !a.passEmailSentAt)
      );

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        count: attendees.length,
        message: `Would send ${attendees.length} email(s).`,
      });
    }

    // Send emails in batches of 5 to avoid rate limiting
    let sent = 0;
    let failed = 0;
    const errors: Array<{ id: string; email: string; error: string }> = [];

    for (let i = 0; i < attendees.length; i += 5) {
      const batch = attendees.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (attendee: Record<string, unknown>) => {
          const result = await sendPassEmail({
            name: (attendee.name as string) || "Attendee",
            email: attendee.email as string,
            pin: (attendee.pin as string) || "",
            qrPayload: (attendee.qrPayload as string) || "",
            ticketTier: (attendee.ticketTier as string) || "general",
          });

          if (result.success) {
            // Mark as sent
            await adminDb
              .collection("attendees")
              .doc(attendee.id as string)
              .update({
                passEmailSentAt: new Date().toISOString(),
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

      // Small delay between batches to avoid rate limits
      if (i + 5 < attendees.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Audit log
    await logAction({
      action: "bulk_pass_email_sent",
      actorId: volunteer?.id || "system",
      actorName: volunteer?.name || "Admin",
      actorRole: "admin",
      details: { sent, failed, total: attendees.length, force },
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
    console.error("Send all passes error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
