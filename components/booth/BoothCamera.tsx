"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw } from "lucide-react";

interface BoothCameraProps {
  onCapture: (imageData: string) => void;
  photoCount: number;
  currentPhoto: number;
  disabled?: boolean;
}

export function BoothCamera({
  onCapture,
  photoCount,
  currentPhoto,
  disabled,
}: BoothCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      setCameraError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera access and reload."
          : "Could not access camera. Make sure no other app is using it."
      );
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
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 600;
    canvas.height = 450;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the image (front-facing camera)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCapture(dataUrl);
  }, [onCapture]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setCountdown(null);
        setFlash(true);
        setTimeout(() => setFlash(false), 200);
        capturePhoto();
      }
    }, 1000);
  }, [capturePhoto]);

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Camera className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {cameraError}
        </p>
        <Button variant="outline" onClick={startCamera}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Camera preview */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] max-w-xl mx-auto">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-8xl font-bold text-white animate-pulse">
              {countdown}
            </span>
          </div>
        )}

        {/* Flash effect */}
        {flash && (
          <div className="absolute inset-0 bg-white animate-pulse" />
        )}

        {/* Photo counter */}
        <div className="absolute top-3 right-3 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
          {currentPhoto} / {photoCount}
        </div>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Capture button */}
      <div className="flex justify-center mt-6">
        <button
          onClick={startCountdown}
          disabled={!cameraReady || disabled || countdown !== null}
          className="h-16 w-16 rounded-full bg-white border-4 border-primary shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          aria-label="Take photo"
        >
          <div className="h-12 w-12 rounded-full bg-primary" />
        </button>
      </div>
    </div>
  );
}
