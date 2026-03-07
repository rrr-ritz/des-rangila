import { PKPass } from "passkit-generator";
import path from "path";
import fs from "fs";

const PASS_MODEL_DIR = path.join(process.cwd(), "public", "passModels", "desrangila.pass");

interface ApplePassData {
  qrPayload: string;
  name: string;
  pin: string;
  stampsCollected: string[];
}

/**
 * Check if Apple Wallet is configured with the necessary certs/env vars.
 */
export function isAppleWalletConfigured(): boolean {
  return !!(
    process.env.APPLE_PASS_TYPE_IDENTIFIER &&
    process.env.APPLE_TEAM_IDENTIFIER &&
    process.env.APPLE_PASS_CERT_PATH &&
    process.env.APPLE_WWDR_CERT_PATH
  );
}

/**
 * Generate a signed .pkpass file for an attendee.
 * Returns a Buffer containing the .pkpass (ZIP) data.
 */
export async function generateApplePass(data: ApplePassData): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error("Apple Wallet is not configured. Set APPLE_* env vars.");
  }

  const wwdrCert = fs.readFileSync(process.env.APPLE_WWDR_CERT_PATH!);
  const signerCert = fs.readFileSync(process.env.APPLE_PASS_CERT_PATH!);

  // The signer key can be a separate file or the same as the cert
  // passkit-generator extracts the key from the cert file
  const signerKeyPath = process.env.APPLE_PASS_KEY_PATH || process.env.APPLE_PASS_CERT_PATH!;
  const signerKey = fs.readFileSync(signerKeyPath);

  const pass = await PKPass.from(
    {
      model: PASS_MODEL_DIR,
      certificates: {
        wwdr: wwdrCert,
        signerCert: signerCert,
        signerKey: signerKey,
        signerKeyPassphrase: process.env.APPLE_PASS_CERT_PASSWORD || "",
      },
    },
    {
      serialNumber: data.qrPayload,
      description: "Des Rangila Digital Passport",
      organizationName: "UMD Indian Student Association",
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER!,
      teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER!,
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(99, 102, 241)", // indigo-500
      labelColor: "rgb(199, 210, 254)", // indigo-200
      webServiceURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/apple-wallet`,
      authenticationToken: data.qrPayload, // Use qrPayload as auth token
    }
  );

  // Barcode
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: data.qrPayload,
    messageEncoding: "iso-8859-1",
  });

  // Primary fields
  pass.primaryFields.push({
    key: "name",
    label: "ATTENDEE",
    value: data.name,
  });

  // Secondary fields
  pass.secondaryFields.push(
    {
      key: "pin",
      label: "PIN",
      value: data.pin,
    }
  );

  // Auxiliary fields
  pass.auxiliaryFields.push({
    key: "stamps",
    label: "TABLES VISITED",
    value: `${data.stampsCollected.length} / 16`,
  });

  // Back fields
  pass.backFields.push(
    {
      key: "event",
      label: "Event",
      value: "Des Rangila — Tour of India",
    },
    {
      key: "date",
      label: "Date",
      value: "April 11, 2026 | 5–8 PM",
    },
    {
      key: "location",
      label: "Location",
      value: "McKeldin Mall, University of Maryland",
    },
    {
      key: "portal",
      label: "Your Photos & Info",
      value: `${process.env.NEXT_PUBLIC_APP_URL}/me`,
    }
  );

  const buffer = pass.getAsBuffer();
  return buffer;
}
