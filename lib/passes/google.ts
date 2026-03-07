import { GoogleAuth } from "google-auth-library";
import jwt from "jsonwebtoken";

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID || "";
const CLASS_ID = process.env.GOOGLE_WALLET_CLASS_ID || `${ISSUER_ID}.desrangila_2026`;

interface GooglePassData {
  qrPayload: string;
  name: string;
  pin: string;
  ticketTier: string;
  stampsCollected: string[];
}

/**
 * Check if Google Wallet is configured.
 */
export function isGoogleWalletConfigured(): boolean {
  return !!(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT
  );
}

/**
 * Get authenticated Google API client.
 */
function getAuthClient(): GoogleAuth {
  const credentials = JSON.parse(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT || "{}");
  return new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
}

/**
 * Ensure the Google Wallet class exists. Creates it if not.
 * Should be called once during setup.
 */
export async function ensureWalletClass(): Promise<void> {
  if (!isGoogleWalletConfigured()) return;

  const auth = getAuthClient();
  const client = await auth.getClient();

  const classUrl = `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${CLASS_ID}`;

  try {
    // Check if class exists
    await client.request({ url: classUrl, method: "GET" });
  } catch {
    // Create class
    const classDefinition = {
      id: CLASS_ID,
      issuerName: "UMD Indian Student Association",
      reviewStatus: "UNDER_REVIEW",
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['pin']" }],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['tier']" }],
                  },
                },
              },
            },
          ],
        },
      },
      linksModuleData: {
        uris: [
          {
            uri: `${process.env.NEXT_PUBLIC_APP_URL}/me`,
            description: "Your Photos & Info",
          },
        ],
      },
    };

    await client.request({
      url: "https://walletobjects.googleapis.com/walletobjects/v1/genericClass",
      method: "POST",
      body: JSON.stringify(classDefinition),
    });
  }
}

/**
 * Create a Google Wallet pass object for an attendee.
 * Returns the object ID.
 */
export async function createWalletObject(data: GooglePassData): Promise<string> {
  if (!isGoogleWalletConfigured()) {
    throw new Error("Google Wallet is not configured.");
  }

  const auth = getAuthClient();
  const client = await auth.getClient();

  const objectId = `${ISSUER_ID}.${data.qrPayload}`;
  const objectUrl = `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`;

  const objectDefinition = {
    id: objectId,
    classId: CLASS_ID,
    state: "ACTIVE",
    header: {
      defaultValue: { language: "en", value: "Des Rangila" },
    },
    subheader: {
      defaultValue: { language: "en", value: "Tour of India" },
    },
    textModulesData: [
      { id: "name", header: "ATTENDEE", body: data.name },
      { id: "pin", header: "PIN", body: data.pin },
      { id: "tier", header: "TICKET", body: data.ticketTier.toUpperCase() },
      {
        id: "stamps",
        header: "TABLES VISITED",
        body: `${data.stampsCollected.length} / 16`,
      },
    ],
    barcode: {
      type: "QR_CODE",
      value: data.qrPayload,
    },
    hexBackgroundColor: "#6366f1",
  };

  try {
    // Try to get existing
    await client.request({ url: objectUrl, method: "GET" });
    // Update if exists
    await client.request({
      url: objectUrl,
      method: "PATCH",
      body: JSON.stringify(objectDefinition),
    });
  } catch {
    // Create new
    await client.request({
      url: "https://walletobjects.googleapis.com/walletobjects/v1/genericObject",
      method: "POST",
      body: JSON.stringify(objectDefinition),
    });
  }

  return objectId;
}

/**
 * Update the stamps count on a Google Wallet pass.
 */
export async function updateWalletStamps(
  qrPayload: string,
  stampsCollected: string[]
): Promise<void> {
  if (!isGoogleWalletConfigured()) return;

  const auth = getAuthClient();
  const client = await auth.getClient();

  const objectId = `${ISSUER_ID}.${qrPayload}`;
  const objectUrl = `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`;

  try {
    await client.request({
      url: objectUrl,
      method: "PATCH",
      body: JSON.stringify({
        textModulesData: [
          { id: "stamps", header: "TABLES VISITED", body: `${stampsCollected.length} / 16` },
        ],
      }),
    });
  } catch (err) {
    console.error("Failed to update Google Wallet pass:", err);
  }
}

/**
 * Generate a Google Wallet "Save" URL using a signed JWT.
 * This URL, when visited, prompts the user to save the pass.
 */
export function generateSaveUrl(data: GooglePassData): string {
  if (!isGoogleWalletConfigured()) {
    throw new Error("Google Wallet is not configured.");
  }

  const credentials = JSON.parse(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT || "{}");

  const objectId = `${ISSUER_ID}.${data.qrPayload}`;

  const claims = {
    iss: credentials.client_email,
    aud: "google",
    typ: "savetowallet",
    origins: [process.env.NEXT_PUBLIC_APP_URL || "https://desrangila.app"],
    payload: {
      genericObjects: [
        {
          id: objectId,
          classId: CLASS_ID,
          state: "ACTIVE",
          header: {
            defaultValue: { language: "en", value: "Des Rangila" },
          },
          subheader: {
            defaultValue: { language: "en", value: "Tour of India" },
          },
          textModulesData: [
            { id: "name", header: "ATTENDEE", body: data.name },
            { id: "pin", header: "PIN", body: data.pin },
            { id: "tier", header: "TICKET", body: data.ticketTier.toUpperCase() },
            {
              id: "stamps",
              header: "TABLES VISITED",
              body: `${data.stampsCollected.length} / 16`,
            },
          ],
          barcode: {
            type: "QR_CODE",
            value: data.qrPayload,
          },
          hexBackgroundColor: "#6366f1",
        },
      ],
    },
  };

  const token = jwt.sign(claims, credentials.private_key, {
    algorithm: "RS256",
  });

  return `https://pay.google.com/gp/v/save/${token}`;
}
