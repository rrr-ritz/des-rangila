"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Check, X, Loader2, RotateCcw, ShieldCheck } from "lucide-react";

interface SelfieCaptureProps {
  attendeeId: string;
  attendeeName: string;
  onComplete: (descriptor: number[] | null) => void;
  onSkip: () => void;
}

export function SelfieCapture({
  attendeeId,
  attendeeName,
  onComplete,
  onSkip,
}: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<"consent" | "camera" | "processing" | "done" | "error">("consent");
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setErrorMsg("Could not access camera. Please allow camera access.");
      setStep("error");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleConsent = () => {
    setStep("camera");
    startCamera();
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror for front-facing
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    stopCamera();
    setStep("processing");

    try {
      // Load face-api models and extract descriptor
      const { loadModels, extractDescriptor } = await import("@/lib/face/detect");
      await loadModels();

      const descriptor = await extractDescriptor(canvas);

      if (!descriptor) {
        setErrorMsg("No face detected. Please try again with good lighting and face the camera directly.");
        setStep("error");
        return;
      }

      // Send descriptor to API
      const descriptorArray = Array.from(descriptor);
      const res = await fetch(`/api/attendees/${attendeeId}/face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor: descriptorArray }),
      });

      if (!res.ok) {
        setErrorMsg("Failed to save face data. Please try again.");
        setStep("error");
        return;
      }

      setStep("done");
      onComplete(descriptorArray);
    } catch (err) {
      console.error("Face detection error:", err);
      setErrorMsg("Face detection failed. Please try again.");
      setStep("error");
    }
  };

  const handleRetry = () => {
    setErrorMsg(null);
    setStep("camera");
    startCamera();
  };

  // CONSENT SCREEN
  if (step === "consent") {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
            <div>
              <h3 className="font-semibold">Link your event photos?</h3>
              <p className="text-sm text-muted-foreground">Hi {attendeeName}!</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            We&apos;ll take a quick selfie to automatically match you in photos taken
            by our photographers during the event. Your face data is a numeric
            vector (not a photo) and is deleted 30 days after the event.
          </p>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleConsent}>
              <Camera className="h-4 w-4 mr-2" />
              Yes, link my photos
            </Button>
            <Button variant="outline" className="flex-1" onClick={onSkip}>
              No thanks
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // CAMERA SCREEN
  if (step === "camera") {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <h3 className="font-semibold">Quick selfie</h3>
          <p className="text-sm text-muted-foreground">
            Face the camera and tap capture
          </p>
        </div>

        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {/* Face outline guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-60 border-2 border-white/40 rounded-[50%]" />
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleCapture}
            disabled={!cameraReady}
          >
            <Camera className="h-5 w-5 mr-2" />
            Capture
          </Button>
        </div>
      </div>
    );
  }

  // PROCESSING SCREEN
  if (step === "processing") {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-12">
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
        <div>
          <h3 className="font-semibold">Processing...</h3>
          <p className="text-sm text-muted-foreground">
            Detecting face and extracting features
          </p>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // ERROR SCREEN
  if (step === "error") {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-12">
        <X className="h-12 w-12 mx-auto text-destructive" />
        <div>
          <h3 className="font-semibold">Something went wrong</h3>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={handleRetry}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Try again
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // DONE SCREEN
  return (
    <div className="max-w-md mx-auto text-center space-y-4 py-12">
      <Check className="h-12 w-12 mx-auto text-green-500" />
      <div>
        <h3 className="font-semibold">All set!</h3>
        <p className="text-sm text-muted-foreground">
          Your event photos will be automatically linked to your profile.
        </p>
      </div>
    </div>
  );
}
