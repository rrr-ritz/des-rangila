import { EventHeader } from "@/components/shared/EventHeader";
import { headers } from "next/headers";

async function getAttendee(qrPayload: string) {
  // In production, this calls Firestore directly via admin SDK
  // For now, we'll use the API route with server-side fetch
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(
      `${appUrl}/api/attendees/by-qr/${qrPayload}`,
      {
        cache: "no-store",
        headers: { Authorization: "Bearer server-internal" },
      }
    );
    if (!res.ok) return null;
    return res.json();
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
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <EventHeader className="mb-8" />
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Pass Not Found</h2>
          <p className="text-muted-foreground">
            This pass link is invalid or has expired.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <EventHeader className="mb-6" />

      <div className="w-full max-w-sm space-y-6">
        {/* Attendee info */}
        <div className="bg-card border rounded-xl p-6 text-center space-y-4">
          <div>
            <h2 className="text-xl font-bold">{attendee.name}</h2>
            <p className="text-sm text-muted-foreground">
              Passport Holder
            </p>
          </div>

          {/* QR Code placeholder — rendered client-side */}
          <QRCodeDisplay payload={params.qrPayload} />

          {/* PIN display */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">YOUR PIN</p>
            <p className="text-2xl font-mono font-bold tracking-widest">
              {attendee.pin}
            </p>
          </div>
        </div>

        {/* Wallet buttons */}
        <div className="space-y-3">
          {isIOS && (
            <a
              href={`/api/passes/apple/${params.qrPayload}`}
              className="flex items-center justify-center gap-2 w-full bg-black text-white rounded-lg py-3 px-4 font-medium hover:bg-black/90 transition-colors"
            >
              Add to Apple Wallet
            </a>
          )}
          {isAndroid && (
            <a
              href={`/api/passes/google/${params.qrPayload}`}
              className="flex items-center justify-center gap-2 w-full bg-[#4285f4] text-white rounded-lg py-3 px-4 font-medium hover:bg-[#4285f4]/90 transition-colors"
            >
              Add to Google Wallet
            </a>
          )}
          {!isIOS && !isAndroid && (
            <p className="text-center text-sm text-muted-foreground">
              Save this page or take a screenshot of your QR code.
            </p>
          )}
        </div>

        {/* Info footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Show this QR code at each table to participate.</p>
          <p>
            View your photos and stamps at{" "}
            <a href="/me" className="underline">
              desrangila.app/me
            </a>
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
