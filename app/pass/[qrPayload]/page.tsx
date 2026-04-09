import { headers } from "next/headers";
import { adminDb } from "@/lib/firebase/admin";

async function getAttendee(qrPayload: string) {
  try {
    const snapshot = await adminDb
      .collection("attendees")
      .where("qrPayload", "==", qrPayload)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data() as { name: string; pin: string; qrPayload: string; stampsCollected?: string[] };
    return { id: doc.id, ...data };
  } catch {
    return null;
  }
}

function detectPlatform(userAgent: string) {
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  return { isIOS, isAndroid };
}

export default async function PassPage({
  params,
}: {
  params: { qrPayload: string };
}) {
  const headersList = headers();
  const userAgent = headersList.get("user-agent") || "";
  const { isIOS, isAndroid } = detectPlatform(userAgent);
  const attendee = await getAttendee(params.qrPayload);

  if (!attendee) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--color-background)]">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border">
          <div className="bg-[var(--color-primary)] px-6 py-7 text-center">
            <h1 className="font-display text-[28px] font-medium text-[var(--color-text-on-primary)] tracking-wide">
              Des Rangila
            </h1>
            <p className="text-xs tracking-[3px] mt-1" style={{ color: '#B4A689' }}>
              TOUR OF INDIA
            </p>
          </div>
          <div className="bg-card p-6 text-center space-y-2">
            <h2 className="text-xl font-semibold">Pass Not Found</h2>
            <p className="text-muted-foreground">
              This pass link is invalid or has expired.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--color-background)]">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border">
        {/* Dark header */}
        <div className="bg-[var(--color-primary)] px-6 py-7 text-center">
          <h1 className="font-display text-[28px] font-medium text-[var(--color-text-on-primary)] tracking-wide">
            Des Rangila
          </h1>
          <p className="text-xs tracking-[3px] mt-1" style={{ color: '#B4A689' }}>
            TOUR OF INDIA
          </p>
        </div>

        {/* Body */}
        <div className="bg-card p-6 space-y-5">
          {/* Event details card */}
          <div className="bg-[var(--color-background)] rounded-xl p-4 border border-border space-y-3">
            <div>
              <p className="text-[11px] tracking-widest text-muted-foreground">EVENT</p>
              <p className="text-sm font-medium mt-0.5">Des Rangila — Tour of India</p>
            </div>
            <div>
              <p className="text-[11px] tracking-widest text-muted-foreground">DATE & TIME</p>
              <p className="text-sm font-medium mt-0.5">Saturday, April 11 · 5:00–8:00 PM</p>
            </div>
            <div>
              <p className="text-[11px] tracking-widest text-muted-foreground">LOCATION</p>
              <p className="text-sm font-medium mt-0.5">McKeldin Mall East, UMD</p>
            </div>
          </div>

          {/* PIN */}
          <div className="text-center">
            <p className="text-[11px] tracking-widest text-muted-foreground mb-2">YOUR PIN</p>
            <p className="text-4xl font-medium tracking-[10px] text-[var(--color-primary)] font-mono">
              {attendee.pin}
            </p>
          </div>

          {/* QR Code */}
          <QRCodeDisplay payload={params.qrPayload} />

          {/* Wallet buttons */}
          {isIOS && (
            <a
              href={`/api/passes/apple/${params.qrPayload}`}
              className="flex items-center justify-center w-full bg-[var(--color-accent)] text-white rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
            >
              Add to Apple Wallet
            </a>
          )}
          {isAndroid && (
            <a
              href={`/api/passes/google/${params.qrPayload}`}
              className="flex items-center justify-center w-full bg-[var(--color-primary)] text-[var(--color-text-on-primary)] rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
            >
              Add to Google Wallet
            </a>
          )}
          {!isIOS && !isAndroid && (
            <>
              <a
                href={`/api/passes/apple/${params.qrPayload}`}
                className="flex items-center justify-center w-full bg-[var(--color-accent)] text-white rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
              >
                Add to Apple Wallet
              </a>
              <a
                href={`/api/passes/google/${params.qrPayload}`}
                className="flex items-center justify-center w-full bg-[var(--color-primary)] text-[var(--color-text-on-primary)] rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
              >
                Add to Google Wallet
              </a>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-card border-t border-border px-6 py-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            Indian Student Association · University of Maryland
          </p>
        </div>
      </div>
    </main>
  );
}

// Client component for QR code rendering
function QRCodeDisplay({ payload }: { payload: string }) {
  // This will be rendered as a server component placeholder
  // The actual QR image is generated via the qrcode library
  return (
    <div className="flex justify-center">
      <div className="bg-white p-4 rounded-lg inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/qr/${payload}`}
          alt="Your QR Code"
          width={200}
          height={200}
          className="w-[200px] h-[200px]"
        />
      </div>
    </div>
  );
}
