import { PKPass } from "passkit-generator";
import path from "path";
import fs from "fs";

const PASS_MODEL_DIR = path.join(process.cwd(), "public", "passModels", "desrangila.pass");

// All 16 stations in table order (for back fields)
const STATIONS = [
  { id: "jammu-kashmir", name: "JAMMU & KASHMIR + LADAKH", activity: "Hair Clip Making" },
  { id: "himachal-uttarakhand", name: "HIMACHAL + UTTARAKHAND", activity: "Postcard Coloring" },
  { id: "punjab", name: "PUNJAB", activity: "Mango Lassi Shots" },
  { id: "haryana-rajasthan", name: "HARYANA + RAJASTHAN", activity: "Block Printing" },
  { id: "gujarat", name: "GUJARAT", activity: "Dandiya Making" },
  { id: "maharashtra", name: "MAHARASHTRA", activity: "Vada Pav" },
  { id: "central-india", name: "CENTRAL INDIA", activity: "Chai" },
  { id: "odisha", name: "ODISHA", activity: "Mehendi / Henna" },
  { id: "west-bengal", name: "WEST BENGAL", activity: "Polaroid Photo Booth" },
  { id: "seven-sisters-sikkim", name: "SEVEN SISTERS + SIKKIM", activity: "Momos" },
  { id: "andhra-telangana", name: "ANDHRA + TELANGANA", activity: "Biryani" },
  { id: "karnataka", name: "KARNATAKA", activity: "Idli" },
  { id: "tamil-nadu", name: "TAMIL NADU", activity: "Uthappam" },
  { id: "kerala", name: "KERALA", activity: "Pookalam (Flower Rangoli)" },
  { id: "registration", name: "CHECK-IN", activity: "" },
  { id: "photo-booth", name: "PHOTO BOOTH", activity: "" },
];

interface ApplePassData {
  qrPayload: string;
  name: string;
  pin: string;
  stampsCollected: string[];
}

/**
 * Load certificate from file path (dev) or base64 env var (Vercel production).
 */
function loadCert(filePath: string | undefined, base64EnvVar: string | undefined): Buffer {
  // Try base64 env var first (Vercel production)
  if (base64EnvVar) {
    return Buffer.from(base64EnvVar, "base64");
  }
  // Fall back to file path (local development)
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  // Try relative to cwd
  if (filePath) {
    const cwdPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(cwdPath)) {
      return fs.readFileSync(cwdPath);
    }
  }
  throw new Error(`Certificate not found: ${filePath}`);
}

/**
 * Check if Apple Wallet is configured with the necessary certs/env vars.
 */
export function isAppleWalletConfigured(): boolean {
  const hasCoreConfig = !!(
    process.env.APPLE_PASS_TYPE_IDENTIFIER &&
    process.env.APPLE_TEAM_IDENTIFIER
  );

  // Need either file paths OR base64 env vars
  const hasFileCerts = !!(
    process.env.APPLE_PASS_CERT_PATH &&
    process.env.APPLE_WWDR_CERT_PATH
  );
  const hasBase64Certs = !!(
    process.env.APPLE_PASS_CERT_P12_BASE64 &&
    process.env.APPLE_WWDR_CERT_BASE64
  );

  return hasCoreConfig && (hasFileCerts || hasBase64Certs);
}

/**
 * Generate a signed .pkpass file for an attendee.
 * Returns a Buffer containing the .pkpass (ZIP) data.
 */
export async function generateApplePass(data: ApplePassData): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error("Apple Wallet is not configured. Set APPLE_* env vars.");
  }

  const signerCert = loadCert(
    process.env.APPLE_PASS_CERT_PATH,
    process.env.APPLE_PASS_CERT_P12_BASE64
  );
  const wwdrCert = loadCert(
    process.env.APPLE_WWDR_CERT_PATH,
    process.env.APPLE_WWDR_CERT_BASE64
  );

  const pass = await PKPass.from(
    {
      model: PASS_MODEL_DIR,
      certificates: {
        wwdr: wwdrCert,
        signerCert: signerCert,
        signerKey: signerCert, // .p12 contains both cert and key
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
      webServiceURL: "https://des-rangila.vercel.app/api/apple-wallet",
      authenticationToken: data.qrPayload,
    }
  );

  // Barcode
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: data.qrPayload,
    messageEncoding: "iso-8859-1",
  });

  // Header fields (top right — event date)
  pass.headerFields.push({
    key: "eventDate",
    label: "DATE",
    value: "11 APR",
  });

  // Primary fields (large, center — tables visited)
  pass.primaryFields.push({
    key: "stamps",
    label: "TABLES VISITED",
    value: `${data.stampsCollected.length} / 16`,
  });

  // Secondary fields (below primary — name and PIN)
  pass.secondaryFields.push(
    {
      key: "attendeeName",
      label: "NAME",
      value: data.name,
    },
    {
      key: "pin",
      label: "PIN",
      value: data.pin,
    }
  );

  // Auxiliary fields (bottom — location)
  pass.auxiliaryFields.push({
    key: "location",
    label: "LOCATION",
    value: "McKeldin Mall East",
  });

  // Back fields — one per station showing visit status
  for (const station of STATIONS) {
    const visited = data.stampsCollected.includes(station.id);
    const label = station.name;
    const value = visited
      ? `\u2705 ${station.activity || "Visited"}`
      : "Not yet visited";

    pass.backFields.push({
      key: `station_${station.id.replace(/-/g, "_")}`,
      label,
      value,
    });
  }

  // Back fields — event info
  pass.backFields.push(
    {
      key: "eventName",
      label: "EVENT",
      value: "Des Rangila \u2014 Tour of India",
    },
    {
      key: "hostedBy",
      label: "HOSTED BY",
      value: "UMD Indian Student Association",
    },
    {
      key: "dateTime",
      label: "DATE & TIME",
      value: "April 11, 2026 | 5\u20138 PM",
    },
    {
      key: "eventLocation",
      label: "LOCATION",
      value: "McKeldin Mall, University of Maryland",
    },
    {
      key: "portal",
      label: "YOUR PHOTOS & STAMPS",
      value: "https://des-rangila.vercel.app/me",
    },
    {
      key: "support",
      label: "SUPPORT",
      value: "passport@desrangila.ritvik.it",
    },
    {
      key: "privacy",
      label: "PRIVACY",
      value: "Face data is stored as a numeric vector and deleted 30 days after the event. See https://des-rangila.vercel.app/privacy for full policy.",
    }
  );

  const buffer = pass.getAsBuffer();
  return buffer;
}
