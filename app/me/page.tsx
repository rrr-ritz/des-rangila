"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PINEntry } from "@/components/attendee/PINEntry";
import { StampPassport } from "@/components/attendee/StampPassport";
import { PhotoGallery } from "@/components/attendee/PhotoGallery";

interface AttendeeData {
  id: string;
  name: string;
  qrPayload?: string;
  checkedIn: boolean;
  stampsCollected: string[];
  totalFoodRedemptions: number;
  maxFoodRedemptions: number;
}

interface PhotoData {
  id: string;
  thumbnailUrl: string;
  storageUrl: string;
  photoType: string;
  takenAt: unknown;
}

export default function AttendeePortalPage() {
  const searchParams = useSearchParams();
  const [attendee, setAttendee] = useState<AttendeeData | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Auto-submit PIN from URL query param
  useEffect(() => {
    const pin = searchParams.get("pin");
    if (pin && pin.length === 4 && !attendee) {
      handlePinSubmit(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handlePinSubmit(pin: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/attendees/by-pin/${pin}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Invalid PIN");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setAttendee(data);

      try {
        const photosRes = await fetch(`/api/photos/by-attendee/${data.id}`);
        if (photosRes.ok) {
          const photosData = await photosRes.json();
          setPhotos(photosData.photos || []);
        }
      } catch {
        // Photos fetch is non-critical
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // PIN entry screen
  if (!attendee) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--color-background)]">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border">
          <div className="bg-[var(--color-primary)] px-6 py-6 text-center">
            <h1 className="font-display text-2xl font-medium text-[var(--color-text-on-primary)]">
              Des Rangila
            </h1>
            <p className="text-[11px] tracking-[3px] mt-1" style={{ color: "#B4A689" }}>
              TOUR OF INDIA
            </p>
          </div>
          <div className="bg-card p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-base font-medium mb-1">Your event passport</h2>
              <p className="text-sm text-muted-foreground">
                Enter your 4-digit PIN to view your stamps and photos.
              </p>
            </div>
            <PINEntry onSubmit={handlePinSubmit} loading={loading} error={error} />
          </div>
        </div>
      </main>
    );
  }

  // ---- Passport booklet ----
  return (
    <main className="min-h-screen pb-8 bg-[var(--color-background)]">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Passport booklet */}
        <div style={{ perspective: "1200px" }}>
          {/* Cover */}
          <div
            onClick={() => !isOpen && setIsOpen(true)}
            className="relative overflow-hidden rounded-xl cursor-pointer select-none"
            style={{
              transformOrigin: "left center",
              transform: isOpen ? "rotateY(-180deg)" : "rotateY(0deg)",
              transition: "transform 700ms cubic-bezier(0.4, 0, 0.2, 1)",
              backfaceVisibility: "hidden",
              minHeight: isOpen ? 0 : undefined,
              height: isOpen ? 0 : undefined,
              opacity: isOpen ? 0 : 1,
            }}
          >
            <div
              className="p-8 text-center"
              style={{
                backgroundColor: "#483932",
                backgroundImage:
                  "radial-gradient(circle at 20% 50%, rgba(212,145,59,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(212,145,59,0.06) 0%, transparent 50%)",
              }}
            >
              {/* Decorative border */}
              <div
                className="border-2 rounded-lg p-8 space-y-4"
                style={{ borderColor: "rgba(212,145,59,0.3)" }}
              >
                <div
                  className="border rounded-md p-6 space-y-3"
                  style={{ borderColor: "rgba(212,145,59,0.15)" }}
                >
                  <p
                    className="text-[10px] tracking-[5px] uppercase"
                    style={{ color: "#B4A689" }}
                  >
                    Digital Passport
                  </p>
                  <h2
                    className="font-display text-3xl font-medium"
                    style={{ color: "#F5E6C8" }}
                  >
                    Des Rangila
                  </h2>
                  <p
                    className="text-xs tracking-[3px] uppercase"
                    style={{ color: "#D4913B" }}
                  >
                    Tour of India 2026
                  </p>
                  <div
                    className="mx-auto h-[1px] w-12 my-3"
                    style={{ backgroundColor: "rgba(212,145,59,0.4)" }}
                  />
                  <p
                    className="text-[9px] tracking-[2px]"
                    style={{ color: "#8C7B6B" }}
                  >
                    INDIAN STUDENT ASSOCIATION
                  </p>
                  <p
                    className="text-[9px] tracking-[2px]"
                    style={{ color: "#8C7B6B" }}
                  >
                    UNIVERSITY OF MARYLAND
                  </p>
                </div>
              </div>

              <p
                className="mt-4 text-[10px] animate-pulse"
                style={{ color: "#8C7B6B" }}
              >
                Tap to open
              </p>
            </div>
          </div>

          {/* Open content */}
          <div
            style={{
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 500ms ease-out 300ms, transform 500ms ease-out 300ms",
              pointerEvents: isOpen ? "auto" : "none",
              height: isOpen ? "auto" : 0,
              overflow: isOpen ? "visible" : "hidden",
            }}
          >
            {/* Passport pages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left page — ID */}
              <div
                className="rounded-xl p-6 space-y-4 border"
                style={{
                  backgroundColor: "#FFFCF7",
                  borderColor: "#E8DFD0",
                  backgroundImage:
                    "radial-gradient(circle at 50% 50%, rgba(72,57,50,0.02) 0%, transparent 70%)",
                }}
              >
                {/* Photo placeholder */}
                <div
                  className="w-24 h-28 mx-auto rounded-md flex items-center justify-center"
                  style={{ backgroundColor: "#E8DFD0" }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8C7B6B"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" />
                  </svg>
                </div>

                <div className="text-center space-y-1">
                  <p className="font-display text-xl font-medium text-[var(--color-primary)]">
                    {attendee.name}
                  </p>
                  <div
                    className="mx-auto h-[1px] w-10"
                    style={{ backgroundColor: "#D4913B" }}
                  />
                </div>

                <div className="space-y-2 text-center">
                  <div>
                    <p className="text-[9px] tracking-[2px] text-muted-foreground uppercase">
                      Passport No.
                    </p>
                    <p className="text-xs font-mono text-[var(--color-primary)]">
                      {attendee.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] tracking-[2px] text-muted-foreground uppercase">
                      Date of Issue
                    </p>
                    <p className="text-xs text-[var(--color-primary)]">
                      April 11, 2026
                    </p>
                  </div>
                </div>

                <p
                  className="text-[8px] tracking-[2px] text-center pt-2"
                  style={{ color: "#8C7B6B" }}
                >
                  UNIVERSITY OF MARYLAND — ISA
                </p>
              </div>

              {/* Right page — Stamps */}
              <div
                className="rounded-xl p-6 border"
                style={{
                  backgroundColor: "#FFFCF7",
                  borderColor: "#E8DFD0",
                }}
              >
                <StampPassport stampsCollected={attendee.stampsCollected || []} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-medium text-[var(--color-primary)]">
                  {attendee.stampsCollected?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Stations visited</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-medium text-[var(--color-primary)]">
                  {attendee.totalFoodRedemptions}/{attendee.maxFoodRedemptions}
                </p>
                <p className="text-xs text-muted-foreground">Food redeemed</p>
              </div>
            </div>

            {/* Close passport button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-full mt-4 py-2 text-xs text-muted-foreground hover:text-[var(--color-primary)] transition-colors"
            >
              Close passport
            </button>
          </div>
        </div>

        {/* Below passport — always visible when open */}
        {isOpen && (
          <div className="space-y-6">
            <PhotoGallery photos={photos} />

            {attendee.qrPayload && (
              <div className="text-center">
                <a
                  href={`/pass/${attendee.qrPayload}`}
                  className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#D4913B" }}
                >
                  Add to Wallet
                </a>
              </div>
            )}

            <div className="text-center pt-2">
              <button
                className="text-sm text-muted-foreground underline"
                onClick={() => {
                  setAttendee(null);
                  setPhotos([]);
                  setIsOpen(false);
                }}
              >
                Use a different PIN
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
