"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BoothCamera } from "@/components/booth/BoothCamera";
import { PhotoStrip } from "@/components/booth/PhotoStrip";
import { AttendeeScanner } from "@/components/booth/AttendeeScanner";
import { Camera, RotateCcw } from "lucide-react";

type BoothStep = "start" | "identify" | "capture" | "preview" | "done";

const PHOTO_COUNT = 3;

interface IdentifiedAttendee {
  id: string;
  name: string;
  email: string;
}

export default function BoothPage() {
  const [step, setStep] = useState<BoothStep>("start");
  const [attendees, setAttendees] = useState<IdentifiedAttendee[]>([]);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const resetBooth = useCallback(() => {
    setStep("start");
    setAttendees([]);
    setCapturedPhotos([]);
    setSaving(false);
  }, []);

  const handleIdentify = (identified: IdentifiedAttendee[]) => {
    setAttendees(identified);
    setCapturedPhotos([]);
    setStep("capture");
  };

  const handleSkip = () => {
    setAttendees([]);
    setCapturedPhotos([]);
    setStep("capture");
  };

  const handleCapture = (imageData: string) => {
    setCapturedPhotos((prev) => {
      const next = [...prev, imageData];
      if (next.length >= PHOTO_COUNT) {
        setStep("preview");
      }
      return next;
    });
  };

  const handleRetake = () => {
    setCapturedPhotos([]);
    setStep("capture");
  };

  const handleSave = async (stripDataUrl: string, thumbnailDataUrl: string) => {
    setSaving(true);
    try {
      // Convert data URLs to blobs
      const stripBlob = await (await fetch(stripDataUrl)).blob();
      const thumbBlob = await (await fetch(thumbnailDataUrl)).blob();

      const formData = new FormData();
      formData.append("strip", stripBlob, `booth_${Date.now()}.jpg`);
      formData.append("thumbnail", thumbBlob, `booth_${Date.now()}_thumb.jpg`);
      formData.append("attendeeIds", JSON.stringify(attendees.map((a) => a.id)));
      formData.append("photoType", "booth");

      // Also append individual photos
      for (let i = 0; i < capturedPhotos.length; i++) {
        const blob = await (await fetch(capturedPhotos[i])).blob();
        formData.append(`photo_${i}`, blob, `booth_${Date.now()}_${i}.jpg`);
      }

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("Upload failed:", await res.text());
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setSaving(false);
      setStep("done");
    }
  };

  // START SCREEN
  if (step === "start") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
        <div className="text-center space-y-8 max-w-md">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">
              Des Rangila
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Photo Booth
            </p>
          </div>

          <div className="relative mx-auto w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
            <Camera className="h-16 w-16 text-primary" />
          </div>

          <Button
            size="lg"
            className="text-lg px-8 h-14"
            onClick={() => setStep("identify")}
          >
            Take a Photo!
          </Button>
        </div>
      </div>
    );
  }

  // IDENTIFY SCREEN
  if (step === "identify") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AttendeeScanner
          onIdentify={handleIdentify}
          onSkip={handleSkip}
        />
      </div>
    );
  }

  // CAPTURE SCREEN — white background acts as fill light for night mode
  if (step === "capture") {
    return (
      <div className="min-h-screen p-4" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-xl mx-auto space-y-4">
          <div className="text-center">
            <h2 className="font-display text-lg font-bold text-black">
              Photo {capturedPhotos.length + 1} of {PHOTO_COUNT}
            </h2>
            {attendees.length > 0 && (
              <p className="text-sm text-black/60">
                {attendees.map((a) => a.name).join(", ")}
              </p>
            )}
          </div>

          <BoothCamera
            onCapture={handleCapture}
            photoCount={PHOTO_COUNT}
            currentPhoto={capturedPhotos.length + 1}
            autoStart
          />

          {/* Show captured thumbnails */}
          {capturedPhotos.length > 0 && (
            <div className="flex justify-center gap-2">
              {capturedPhotos.map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={photo}
                  alt={`Photo ${i + 1}`}
                  className="h-16 w-auto rounded border"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // PREVIEW SCREEN
  if (step === "preview") {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="text-center">
            <h2 className="font-display text-lg font-bold">Your Photo Strip</h2>
          </div>
          <PhotoStrip
            photos={capturedPhotos}
            onSave={handleSave}
            onRetake={handleRetake}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  // DONE SCREEN
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-5xl">📸</div>
        <div>
          <h2 className="font-display text-2xl font-bold">Photos saved!</h2>
          <p className="text-muted-foreground mt-2">
            {attendees.length > 0
              ? "View your photos anytime at desrangila.app/me"
              : "Your photos have been saved to the event gallery."}
          </p>
        </div>
        <Button size="lg" onClick={resetBooth}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Next Person
        </Button>
      </div>
    </div>
  );
}
