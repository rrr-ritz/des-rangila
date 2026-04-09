"use client";

import { useState } from "react";
import { PINEntry } from "@/components/attendee/PINEntry";
import { StampPassport } from "@/components/attendee/StampPassport";
import { PhotoGallery } from "@/components/attendee/PhotoGallery";

interface AttendeeData {
  id: string;
  name: string;
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

export default function AttendePortalPage() {
  const [attendee, setAttendee] = useState<AttendeeData | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      // Fetch photos
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
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border">
          <div className="bg-[var(--color-primary)] px-6 py-6 text-center">
            <h1 className="font-display text-2xl font-medium text-[var(--color-text-on-primary)]">
              Des Rangila
            </h1>
            <p className="text-[11px] tracking-[3px] mt-1" style={{ color: '#B4A689' }}>
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

  // Attendee dashboard
  return (
    <main className="min-h-screen pb-8 max-w-lg mx-auto">
      {/* Dark personalized header */}
      <div className="bg-[var(--color-primary)] px-6 py-5 text-center mb-6">
        <p className="font-display text-xl font-medium text-[var(--color-text-on-primary)]">
          {attendee.name}&apos;s Passport
        </p>
        <p className="text-[11px] tracking-[3px] mt-1" style={{ color: '#B4A689' }}>
          DES RANGILA · APRIL 11, 2026
        </p>
      </div>

      <div className="px-4 space-y-8">
        <StampPassport stampsCollected={attendee.stampsCollected || []} />

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
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

        <PhotoGallery photos={photos} />

        <div className="text-center pt-4">
          <button
            className="text-sm text-muted-foreground underline"
            onClick={() => { setAttendee(null); setPhotos([]); }}
          >
            Use a different PIN
          </button>
        </div>
      </div>
    </main>
  );
}
