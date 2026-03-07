"use client";

import { useEffect, useRef, useState } from "react";

interface QRScannerProps {
  onScan: (payload: string) => void;
  /** When true, scanner keeps running but ignores decoded results. */
  paused: boolean;
}

/**
 * Always-on QR scanner optimized for outdoor event use.
 *
 * Performance optimizations:
 * - 720p resolution (less pixels = faster QR decode)
 * - 15 FPS scan rate (fast enough for instant detection, saves battery)
 * - Autofocus locked to mid-range (~30cm) to prevent hunting between scans
 * - Instant haptic feedback on decode (before any network call)
 * - 5-second dedup window to prevent re-scanning same code
 *
 * The camera NEVER stops while mounted — the `paused` prop only controls
 * whether decoded results fire the onScan callback.
 */
export function QRScanner({ onScan, paused }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const scannerRef = useRef<unknown>(null);

  // Use refs so the scanner callback always has the latest values
  // without needing to re-create the scanner instance.
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  const lastScannedRef = useRef<{ payload: string; time: number } | null>(
    null
  );

  // Keep refs in sync
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      try {
        // Dynamic import to avoid SSR issues
        const QrScanner = (await import("qr-scanner")).default;
        if (cancelled || !videoRef.current) return;

        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            // Ignore scans while showing a result overlay
            if (pausedRef.current) return;

            const payload = result.data;
            if (!payload || !payload.startsWith("DR-")) return;

            // Deduplicate: skip same payload within 5 seconds.
            // Prevents re-firing when the same QR code is still in frame
            // after a result overlay auto-dismisses.
            const now = Date.now();
            if (
              lastScannedRef.current &&
              lastScannedRef.current.payload === payload &&
              now - lastScannedRef.current.time < 5000
            ) {
              return;
            }
            lastScannedRef.current = { payload, time: now };

            // Instant haptic feedback — volunteer feels vibration within
            // ~100ms of QR code entering the camera frame, before any
            // database lookup or network call.
            try {
              navigator.vibrate(100);
            } catch {
              // Vibration API not supported (e.g., iOS Safari)
            }

            onScanRef.current(payload);
          },
          {
            preferredCamera: "environment",
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 15,
          }
        );

        scannerRef.current = scanner;
        await scanner.start();

        // === Post-start camera optimizations ===
        // Apply after the camera is already streaming.
        if (videoRef.current?.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          const track = stream.getVideoTracks()[0];
          if (track) {
            // 1. Request 720p resolution
            // Less pixels per frame = faster QR decoding.
            // QR codes don't need high resolution.
            try {
              await track.applyConstraints({
                width: { ideal: 1280 },
                height: { ideal: 720 },
              });
            } catch {
              // Camera will use whatever resolution it supports
            }

            // 2. Lock autofocus to mid-range (~30cm)
            // Prevents the camera from hunting between scans.
            // Only supported in Chrome on Android — falls back gracefully.
            try {
              const capabilities = track.getCapabilities() as Record<
                string,
                unknown
              >;
              const focusModes = capabilities.focusMode as
                | string[]
                | undefined;

              if (focusModes?.includes("manual")) {
                const constraints: Record<string, unknown> = {
                  focusMode: "manual",
                };
                const focusRange = capabilities.focusDistance as
                  | { min: number; max: number }
                  | undefined;
                if (focusRange) {
                  // Set focus to ~30cm — typical QR scanning distance
                  constraints.focusDistance = Math.max(
                    focusRange.min,
                    Math.min(0.3, focusRange.max)
                  );
                }
                await track.applyConstraints({
                  advanced: [constraints as MediaTrackConstraintSet],
                });
              }
            } catch {
              // Autofocus lock not supported — auto mode continues
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Camera access denied"
          );
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        (scannerRef.current as { stop: () => void }).stop();
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once — scanner lives for the component's entire lifetime

  if (error) {
    return (
      <div className="aspect-[3/4] rounded-lg bg-muted flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-destructive font-medium mb-1">
            Camera Error
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Please allow camera access and reload the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        autoPlay
        muted
      />
    </div>
  );
}
