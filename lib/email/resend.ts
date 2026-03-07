import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Check if the email service is configured.
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Des Rangila <noreply@desrangila.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://desrangila.app";

/**
 * Send the pass distribution email to an attendee.
 */
export async function sendPassEmail(attendee: {
  name: string;
  email: string;
  pin: string;
  qrPayload: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    const passUrl = `${APP_URL}/pass/${attendee.qrPayload}`;
    const portalUrl = `${APP_URL}/me`;
    const qrImageUrl = `${APP_URL}/api/qr/${attendee.qrPayload}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: attendee.email,
      subject: "Your Des Rangila Digital Passport",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:#6366f1;padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">Des Rangila</h1>
      <p style="color:#c7d2fe;margin:8px 0 0;font-size:14px;">Tour of India</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;">
      <p style="color:#1f2937;font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi ${attendee.name},
      </p>
      <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Your digital passport for Des Rangila is ready! Show the QR code below
        at each table to participate in activities and collect food.
      </p>

      <!-- Event Details -->
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">EVENT</p>
        <p style="margin:0 0 12px;font-size:15px;color:#1f2937;font-weight:600;">
          Des Rangila — Tour of India
        </p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">DATE & TIME</p>
        <p style="margin:0 0 12px;font-size:15px;color:#1f2937;">
          Saturday, April 11, 2026 | 5:00 PM - 8:00 PM
        </p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">LOCATION</p>
        <p style="margin:0;font-size:15px;color:#1f2937;">
          McKeldin Mall East, University of Maryland
        </p>
      </div>

      <!-- PIN -->
      <div style="text-align:center;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">YOUR PIN</p>
        <p style="margin:0;font-size:36px;font-weight:bold;color:#6366f1;letter-spacing:8px;font-family:monospace;">
          ${attendee.pin}
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
          Digital Passport
        </p>
      </div>

      <!-- QR Code -->
      <div style="text-align:center;margin:0 0 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">YOUR QR CODE</p>
        <img src="${qrImageUrl}" alt="QR Code" width="200" height="200"
             style="border:1px solid #e5e7eb;border-radius:8px;" />
        <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
          Show this at each table
        </p>
      </div>

      <!-- Add to Wallet Button -->
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${passUrl}"
           style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          Add to Wallet
        </a>
        <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
          Opens on iPhone (Apple Wallet) or Android (Google Wallet)
        </p>
      </div>

      <!-- Instructions -->
      <div style="border-top:1px solid #e5e7eb;padding-top:24px;margin-top:24px;">
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 12px;">
          <strong>How it works:</strong>
        </p>
        <ol style="font-size:14px;color:#4b5563;line-height:1.8;margin:0;padding-left:20px;">
          <li>Show your QR code at each of the 16 tables</li>
          <li>A volunteer scans it to log your visit</li>
          <li>Collect stamps and enjoy food & activities!</li>
          <li>Visit the photo booth for a souvenir strip</li>
        </ol>
      </div>

      <!-- Portal Link -->
      <div style="text-align:center;margin-top:32px;">
        <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">
          View your stamps and photos anytime:
        </p>
        <a href="${portalUrl}" style="color:#6366f1;font-size:14px;font-weight:500;">
          ${portalUrl}
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Indian Student Association &bull; University of Maryland
      </p>
      <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">
        Questions? Reach out to isa@umd.edu
      </p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}

/**
 * Send the post-event memories email to an attendee.
 */
export async function sendPostEventEmail(attendee: {
  name: string;
  email: string;
  pin: string;
  stampsCollected: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    const portalUrl = `${APP_URL}/me`;
    const stampCount = attendee.stampsCollected.length;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: attendee.email,
      subject: "Your Des Rangila Memories Are Ready!",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:#6366f1;padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">Des Rangila</h1>
      <p style="color:#c7d2fe;margin:8px 0 0;font-size:14px;">Tour of India</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;">
      <p style="color:#1f2937;font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi ${attendee.name},
      </p>
      <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Thank you for celebrating with us at Des Rangila! We hope you had an
        amazing time exploring the Tour of India.
      </p>

      <!-- Stats -->
      <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:0 0 24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:48px;">
          ${stampCount >= 14 ? "🏆" : stampCount >= 10 ? "⭐" : stampCount >= 6 ? "🎉" : "🎪"}
        </p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">YOU VISITED</p>
        <p style="margin:0;font-size:32px;font-weight:bold;color:#6366f1;">
          ${stampCount} / 16
        </p>
        <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">stations</p>
      </div>

      <!-- Photos CTA -->
      <div style="text-align:center;margin:0 0 24px;">
        <p style="font-size:14px;color:#4b5563;margin:0 0 16px;">
          Your event photos are ready to view and download!
        </p>
        <a href="${portalUrl}"
           style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          View My Photos
        </a>
      </div>

      <!-- PIN Reminder -->
      <div style="text-align:center;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Your PIN</p>
        <p style="margin:0;font-size:20px;font-weight:bold;color:#6366f1;letter-spacing:4px;font-family:monospace;">
          ${attendee.pin}
        </p>
      </div>

      <!-- Reminder -->
      <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:20px;">
        <p style="font-size:13px;color:#9ca3af;text-align:center;margin:0;">
          Photos will be available for 30 days. Download them before they expire!
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Indian Student Association &bull; University of Maryland
      </p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}
