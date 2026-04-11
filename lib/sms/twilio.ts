import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

export async function sendPassSMS(
  phone: string,
  pin: string,
  passUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.messages.create({
      body: `🎪 Des Rangila — Tour of India\n\nYour passport PIN: ${pin}\n\nView your passport & add to wallet:\n${passUrl}\n\nEnjoy the festival! 🇮🇳`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMS send failed";
    return { success: false, error: message };
  }
}
