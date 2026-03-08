"use client";

import { useState } from "react";
import { EventHeader } from "@/components/shared/EventHeader";
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
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <EventHeader className="mb-8" />
        <div className="w-full max-w-xs space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-1">Your Event Passport</h2>
            <p className="text-sm text-muted-foreground">
              Enter your 4-digit PIN to view your stamps and photos.
            </p>
          </div>
          <PINEntry
            onSubmit={handlePinSubmit}
            loading={loading}
            error={error}
          />
        </div>
      </main>
    );
  }

  // Attendee dashboard
  return (
    <main className="min-h-screen p-4 pb-8 max-w-lg mx-auto">
      <EventHeader className="py-4" />

      {/* Welcome header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold">Welcome, {attendee.name}!</h2>
        <p className="text-sm text-muted-foreground">
          Passport Holder
        </p>
      </div>

      <div className="space-y-8">
        {/* Stamp passport */}
        <StampPassport stampsCollected={attendee.stampsCollected || []} />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">
              {attendee.stampsCollected?.length || 0}
            </p>
            <p className="text-xs text-muted-foreground">Stations Visited</p>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">
              {attendee.totalFoodRedemptions}/{attendee.maxFoodRedemptions}
            </p>
            <p className="text-xs text-muted-foreground">Food Redeemed</p>
          </div>
        </div>

        {/* Photos */}
        <PhotoGallery photos={photos} />

        {/* Sign out */}
        <div className="text-center pt-4">
          <button
            className="text-sm text-muted-foreground underline"
            onClick={() => {
              setAttendee(null);
              setPhotos([]);
            }}
          >
            Use a different PIN
          </button>
        </div>
      </div>
    </main>
  );
}
