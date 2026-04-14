"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  SkipForward,
  Loader2,
  User,
  PartyPopper,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface AttendeeListItem {
  id: string;
  name: string;
  selfieUrl: string | null;
  photoCount: number;
}

interface PhotoItem {
  id: string;
  thumbnailUrl?: string;
  storageUrl?: string;
  photoType?: string;
}

export function AttendeePreview() {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<AttendeeListItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhotos, setCurrentPhotos] = useState<PhotoItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);

  // Fetch attendee list on mount
  const fetchAttendees = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/photos/attendees-with-photos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAttendees(data.attendees || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  // Fetch current attendee's photos when index changes
  const fetchCurrentPhotos = useCallback(async () => {
    if (!user || attendees.length === 0) return;
    const attendee = attendees[currentIndex];
    if (!attendee) return;
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/photos/by-attendee/${attendee.id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPhotos(data.photos || []);
      } else {
        setCurrentPhotos([]);
      }
    } catch {
      setCurrentPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }, [user, attendees, currentIndex]);

  useEffect(() => {
    fetchCurrentPhotos();
  }, [fetchCurrentPhotos]);

  const advance = () => {
    if (currentIndex < attendees.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCurrentIndex(attendees.length); // overflow = "done" state
    }
  };

  const goBack = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const removePhoto = async (photoId: string) => {
    if (!user || currentIndex >= attendees.length) return;
    const attendee = attendees[currentIndex];
    setRemovingPhotoId(photoId);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/photos/${photoId}/unlink`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ attendeeId: attendee.id }),
      });
      if (res.ok) {
        setCurrentPhotos((prev) => prev.filter((p) => p.id !== photoId));
        // Decrement count in attendee list
        setAttendees((prev) =>
          prev.map((a, i) =>
            i === currentIndex ? { ...a, photoCount: Math.max(0, a.photoCount - 1) } : a
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setRemovingPhotoId(null);
    }
  };

  if (loadingList) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attendees.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No attendees have matched photos yet.</p>
      </div>
    );
  }

  // Done state
  if (currentIndex >= attendees.length) {
    return (
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="py-16 text-center space-y-4">
          <PartyPopper className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-xl font-bold">All done!</h2>
          <p className="text-sm text-muted-foreground">
            You&apos;ve reviewed all {attendees.length} attendees.
          </p>
          <Button onClick={() => setCurrentIndex(0)} variant="outline">
            Start Over
          </Button>
        </CardContent>
      </Card>
    );
  }

  const attendee = attendees[currentIndex];

  return (
    <Card className="border-2 border-amber-200/50 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10">
      <CardContent className="p-6 space-y-6">
        {/* Header row: prev / counter / next */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={goBack}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <p className="text-sm font-mono font-semibold text-muted-foreground">
            {currentIndex + 1} / {attendees.length}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={advance}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Attendee identity block */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-30 h-30 rounded-full overflow-hidden bg-muted border-2 border-border" style={{ width: 120, height: 120 }}>
            {attendee.selfieUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attendee.selfieUrl}
                alt={attendee.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold">{attendee.name}</h2>
          <p className="text-sm text-muted-foreground">
            {currentPhotos.length} matched photo{currentPhotos.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Photo grid */}
        {loadingPhotos ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentPhotos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No photos remaining for this attendee.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentPhotos.map((photo) => (
              <div key={photo.id} className="space-y-2">
                <div className="rounded-lg overflow-hidden bg-muted border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnailUrl || photo.storageUrl}
                    alt="Matched photo"
                    className="w-full h-auto object-contain"
                    style={{ minHeight: 400 }}
                    loading="lazy"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => removePhoto(photo.id)}
                  disabled={removingPhotoId === photo.id}
                >
                  {removingPhotoId === photo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <X className="h-4 w-4 mr-1" />
                  )}
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" onClick={advance}>
            <SkipForward className="h-4 w-4 mr-2" />
            Skip
          </Button>
          <Button onClick={advance}>
            <Check className="h-4 w-4 mr-2" />
            Looks Good
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
