"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw } from "lucide-react";

interface BoothCameraProps {
  onCapture: (imageData: string) => void;
  photoCount: number;
  currentPhoto: number;
  disabled?: boolean;
  autoStart?: boolean;
}

export function BoothCamera({
  onCapture,
  photoCount,
  currentPhoto,
  disabled,
  autoStart,
}: BoothCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [waitingForStart, setWaitingForStart] = useState(true);
  const countdownActiveRef = useRef(false);
  const lastAutoPhotoRef = useRef(0);

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

    // Center-crop video to match 4:3 target without distortion
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetAspect = 600 / 450;
    const srcAspect = vw / vh;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (srcAspect > targetAspect) {
      sw = vh * targetAspect;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetAspect;
      sy = (vh - sh) / 2;
    }

    // Mirror the image (front-facing camera)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCapture(dataUrl);
  }, [onCapture]);

  const startCountdown = useCallback(() => {
    if (countdownActiveRef.current) return;
    countdownActiveRef.current = true;
    setCountdown(5);
    let count = 5;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setCountdown(null);
        countdownActiveRef.current = false;
        setFlash(true);
        setTimeout(() => setFlash(false), 350);
        capturePhoto();
      }
    }, 1000);
  }, [capturePhoto]);

  // Handle manual start tap — begins first countdown
  const handleStart = useCallback(() => {
    setWaitingForStart(false);
    startCountdown();
  }, [startCountdown]);

  // Auto-fire: after photo 1, automatically start countdown for subsequent photos
  useEffect(() => {
    if (!autoStart || !cameraReady || waitingForStart) return;
    // Only auto-fire for photos 2+
    if (currentPhoto <= 1) return;
    if (lastAutoPhotoRef.current === currentPhoto) return;
    lastAutoPhotoRef.current = currentPhoto;

    const timer = setTimeout(() => startCountdown(), 1000);
    return () => clearTimeout(timer);
  }, [autoStart, cameraReady, currentPhoto, startCountdown, waitingForStart]);

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
          style={{ transform: "scaleX(-1)", filter: "brightness(1.2)" }}
        />

        {/* Start button overlay — shown before first photo */}
        {autoStart && waitingForStart && cameraReady && countdown === null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handleStart}
              className="bg-white text-black font-bold text-2xl px-12 py-5 rounded-2xl shadow-2xl active:scale-95 transition-transform"
            >
              Start
            </button>
          </div>
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-9xl font-bold text-white drop-shadow-lg" style={{ textShadow: "0 0 40px rgba(255,255,255,0.5)" }}>
              {countdown}
            </span>
          </div>
        )}

        {/* Flash effect — intense, longer duration */}
        {flash && (
          <div className="absolute inset-0 bg-white" style={{ opacity: 0.95 }} />
        )}

        {/* Photo counter */}
        <div className="absolute top-3 right-3 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
          {currentPhoto} / {photoCount}
        </div>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Show manual capture button only if not auto-firing */}
      {!autoStart && (
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
      )}
    </div>
  );
}
