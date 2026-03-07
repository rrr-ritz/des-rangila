import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { generatePin, generateQrPayload } from "@/lib/pin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

interface CsvRow {
  name: string;
  email: string;
  ticket_tier: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  const tierIdx = headers.indexOf("ticket_tier");

  if (nameIdx === -1 || emailIdx === -1) {
    throw new Error("CSV must have 'name' and 'email' columns");
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      name: cols[nameIdx] || "",
      email: cols[emailIdx] || "",
      ticket_tier: tierIdx !== -1 ? cols[tierIdx] || "general" : "general",
    };
  }).filter((row) => row.name && row.email);
}

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // Collect existing emails for deduplication
    const existingSnapshot = await adminDb.collection("attendees").get();
    const existingEmails = new Set(
      existingSnapshot.docs.map((doc) => doc.data().email?.toLowerCase())
    );

    // Collect existing PINs and QR payloads to ensure uniqueness
    const existingPins = new Set(
      existingSnapshot.docs.map((doc) => doc.data().pin)
    );
    const existingQrPayloads = new Set(
      existingSnapshot.docs.map((doc) => doc.data().qrPayload)
    );

    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    // Process in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = rows.slice(i, i + BATCH_SIZE);

      for (const row of chunk) {
        if (existingEmails.has(row.email.toLowerCase())) {
          duplicates++;
          continue;
        }

        // Generate unique PIN
        let pin = generatePin();
        while (existingPins.has(pin)) {
          pin = generatePin();
        }
        existingPins.add(pin);

        // Generate unique QR payload
        let qrPayload = generateQrPayload();
        while (existingQrPayloads.has(qrPayload)) {
          qrPayload = generateQrPayload();
        }
        existingQrPayloads.add(qrPayload);

        const tier = row.ticket_tier === "vip" ? "vip" : "general";
        const now = Timestamp.now();

        const ref = adminDb.collection("attendees").doc();
        batch.set(ref, {
          id: ref.id,
          pin,
          qrPayload,
          name: row.name,
          email: row.email.toLowerCase(),
          ticketTier: tier,
          checkedIn: false,
          checkedInAt: null,
          faceDescriptor: null,
          faceConsentGiven: false,
          stampsCollected: [],
          totalFoodRedemptions: 0,
          maxFoodRedemptions: tier === "vip" ? 10 : 5,
          walletPassGenerated: false,
          walletPassType: null,
          createdAt: now,
          updatedAt: now,
        });

        existingEmails.add(row.email.toLowerCase());
        imported++;
      }

      try {
        await batch.commit();
      } catch {
        errors += chunk.length;
        imported -= chunk.length - duplicates;
      }
    }

    await logAction({
      action: "admin.import_attendees",
      actorId: "admin",
      actorName: "Admin",
      actorRole: "admin",
      details: { imported, duplicates, errors, total: rows.length },
      severity: "info",
      notifyAdmins: true,
    });

    return NextResponse.json({
      imported,
      duplicates,
      errors,
      total: rows.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
