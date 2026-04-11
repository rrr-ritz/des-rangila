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
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border-2" style={{ borderColor: "#E8DFD0" }}>
          <div className="bg-[var(--color-primary)] px-6 py-7 text-center">
            <h1 className="font-display text-[28px] font-medium text-[var(--color-text-on-primary)] tracking-wide">
              Des Rangila
            </h1>
            <p className="text-xs tracking-[3px] mt-1" style={{ color: "#B4A689" }}>
              TOUR OF INDIA
            </p>
          </div>
          <div className="bg-card p-6 text-center space-y-2">
            <h2 className="font-display text-xl font-medium" style={{ color: "#483932" }}>Pass Not Found</h2>
            <p className="text-muted-foreground text-sm">
              This pass link is invalid or has expired.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--color-background)]">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border-2" style={{ borderColor: "#E8DFD0" }}>
        {/* Dark header */}
        <div className="bg-[var(--color-primary)] px-6 py-7 text-center">
          <p className="text-[10px] tracking-[4px] uppercase mb-2" style={{ color: "#8C7B6B" }}>
            Digital Passport
          </p>
          <h1 className="font-display text-[28px] font-medium text-[var(--color-text-on-primary)] tracking-wide">
            Des Rangila
          </h1>
          <p className="text-xs tracking-[3px] mt-1" style={{ color: "#B4A689" }}>
            TOUR OF INDIA
          </p>
        </div>

        {/* Inner decorative border */}
        <div className="bg-card p-4">
          <div className="border rounded-xl p-5 space-y-5" style={{ borderColor: "#E8DFD0", backgroundColor: "#FFFCF7" }}>
            {/* Attendee name */}
            <div className="text-center">
              <p className="text-[10px] tracking-[2px] uppercase text-muted-foreground mb-1">Passport holder</p>
              <p className="font-display text-lg font-medium" style={{ color: "#483932" }}>
                {attendee.name}
              </p>
            </div>

            {/* Event details */}
            <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "#FDF8F0", border: "1px solid #E8DFD0" }}>
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-muted-foreground">Event</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: "#483932" }}>Des Rangila — Tour of India</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-muted-foreground">Date &amp; Time</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: "#483932" }}>Saturday, April 11 · 5:00–8:00 PM</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[2px] uppercase text-muted-foreground">Location</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: "#483932" }}>McKeldin Mall East, UMD</p>
              </div>
            </div>

            {/* PIN */}
            <div className="text-center py-2">
              <p className="text-[10px] tracking-[2px] uppercase text-muted-foreground mb-2">Your PIN</p>
              <p className="text-4xl font-medium tracking-[10px] font-mono" style={{ color: "#D4913B" }}>
                {attendee.pin}
              </p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-xl inline-block border" style={{ borderColor: "#E8DFD0" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr/${params.qrPayload}`}
                  alt="Your QR Code"
                  width={200}
                  height={200}
                  className="w-[200px] h-[200px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Wallet buttons + links */}
        <div className="bg-card px-4 pb-4 space-y-3">
          {isIOS && (
            <a
              href={`/api/passes/apple/${params.qrPayload}`}
              className="flex items-center justify-center w-full text-white rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#D4913B" }}
            >
              Add to Apple Wallet
            </a>
          )}
          {isAndroid && (
            <a
              href={`/api/passes/google/${params.qrPayload}`}
              className="flex items-center justify-center w-full rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#483932", color: "#F5E6C8" }}
            >
              Add to Google Wallet
            </a>
          )}
          {!isIOS && !isAndroid && (
            <>
              <a
                href={`/api/passes/apple/${params.qrPayload}`}
                className="flex items-center justify-center w-full text-white rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#D4913B" }}
              >
                Add to Apple Wallet
              </a>
              <a
                href={`/api/passes/google/${params.qrPayload}`}
                className="flex items-center justify-center w-full rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#483932", color: "#F5E6C8" }}
              >
                Add to Google Wallet
              </a>
            </>
          )}

          <a
            href="/me"
            className="flex items-center justify-center w-full py-2.5 text-sm font-medium hover:underline transition-colors"
            style={{ color: "#705f3d" }}
          >
            View Full Passport &rarr;
          </a>
        </div>

        {/* Footer */}
        <div className="bg-card border-t px-6 py-4 text-center" style={{ borderColor: "#E8DFD0" }}>
          <p className="text-[10px] tracking-[1px] text-muted-foreground">
            Indian Student Association · University of Maryland
          </p>
        </div>
      </div>
    </main>
  );
}
