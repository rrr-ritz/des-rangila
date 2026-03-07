import crypto from "crypto";

/**
 * Generate a cryptographically random 6-digit PIN.
 */
export function generatePin(): string {
  // Generate a random number between 100000 and 999999
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Generate a unique QR payload string in the format "DR-{8 alphanumeric chars}".
 */
export function generateQrPayload(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous: 0/O, 1/I
  let result = "DR-";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Validate a PIN format (exactly 6 digits).
 */
export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Validate a QR payload format.
 */
export function isValidQrPayload(payload: string): boolean {
  return /^DR-[A-Z2-9]{8}$/.test(payload);
}
