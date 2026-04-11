"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendeeInfo {
  id: string;
  name: string;
  checkedIn: boolean;
  stampsCollected: string[];
  totalFoodRedemptions: number;
  maxFoodRedemptions: number;
  selfieStorageUrl?: string;
}

interface ScanResultProps {
  attendee: AttendeeInfo;
  stationId: string;
  stationType: string;
  foodItem: string | null;
  onRedeem: (itemType: string) => Promise<void>;
  onDismiss: () => void;
  soundEnabled?: boolean;
}

/**
 * Play a short success beep via Web Audio API.
 * No external files needed — generates a 150ms A5 tone.
 */
function playSuccessBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      ((window as unknown as Record<string, typeof AudioContext>)
        .webkitAudioContext as typeof AudioContext);
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880; // A5
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

/**
 * Scan result overlay optimized for outdoor visibility.
 *
 * Design goals:
 * - Large, high-contrast icons visible in direct sunlight
 * - Colored backgrounds (not subtle border changes)
 * - 48px+ touch targets for all interactive elements
 * - Auto-dismiss success after 3 seconds
 * - Distinct haptic patterns: success (200ms pulse) vs error (double tap)
 */
export function ScanResult({
  attendee,
  stationId,
  stationType,
  foodItem,
  onRedeem,
  onDismiss,
  soundEnabled = false,
}: ScanResultProps) {
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  const hasVisited = attendee.stampsCollected?.includes(stationId);
  const foodLimitReached =
    (attendee.totalFoodRedemptions || 0) >= (attendee.maxFoodRedemptions || 8);

  async function handleRedeem(itemType: string) {
    setRedeeming(true);
    try {
      await onRedeem(itemType);
      setResult({ type: "success", message: "Redeemed!" });

      // Success haptic: single satisfying pulse
      try {
        navigator.vibrate(200);
      } catch {
        // Not supported
      }

      // Success sound (off by default, configurable)
      if (soundEnabled) playSuccessBeep();

      // Auto-dismiss after 3 seconds — scanner resumes immediately
      setTimeout(onDismiss, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Redemption failed";
      if (msg.includes("Already redeemed")) {
        setResult({ type: "warning", message: msg });
      } else {
        setResult({ type: "error", message: msg });
      }

      // Error haptic: two short pulses (clearly different from success)
      try {
        navigator.vibrate([50, 50, 50]);
      } catch {
        // Not supported
      }
    } finally {
      setRedeeming(false);
    }
  }

  // === RESULT STATE — Full-color, high-contrast for outdoor visibility ===
  if (result) {
    return (
      <>
        <style>{`
          @keyframes pop-in {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <div
          className={cn(
            "rounded-2xl p-8 text-center space-y-4 text-white w-full max-w-sm shadow-2xl",
            result.type === "success" && "bg-green-600",
            result.type === "error" && "bg-red-600",
            result.type === "warning" && "bg-amber-500"
          )}
        >
          <div style={{ animation: "pop-in 0.4s ease-out forwards" }}>
            {result.type === "success" && (
              <CheckCircle
                className="h-24 w-24 mx-auto"
                strokeWidth={2.5}
              />
            )}
            {result.type === "error" && (
              <XCircle className="h-24 w-24 mx-auto" strokeWidth={2.5} />
            )}
            {result.type === "warning" && (
              <AlertTriangle
                className="h-24 w-24 mx-auto"
                strokeWidth={2.5}
              />
            )}
          </div>

          <p className="font-bold text-2xl">{result.message}</p>
          <p className="text-lg opacity-90">{attendee.name}</p>

          <Button
            variant="outline"
            size="lg"
            onClick={onDismiss}
            className="bg-white/20 border-white/40 text-white hover:bg-white/30 hover:text-white text-base font-semibold min-h-[48px]"
          >
            Scan Next
          </Button>

          {result.type === "success" && (
            <p className="text-sm opacity-70">Auto-resuming in 3s...</p>
          )}
        </div>
      </>
    );
  }

  const canActivity = !hasVisited && (stationType === "activity" || stationType === "both");
  const canFood = !hasVisited && !foodLimitReached && !!foodItem && (stationType === "food" || stationType === "both");

  async function handleRedeemBoth() {
    setRedeeming(true);
    try {
      // Redeem food first, then activity
      await onRedeem(foodItem!);
      await onRedeem("activity");
      setResult({ type: "success", message: "Redeemed!" });
      try { navigator.vibrate(200); } catch {}
      if (soundEnabled) playSuccessBeep();
      setTimeout(onDismiss, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Redemption failed";
      if (msg.includes("Already redeemed")) {
        setResult({ type: "warning", message: msg });
      } else {
        setResult({ type: "error", message: msg });
      }
      try { navigator.vibrate([50, 50, 50]); } catch {}
    } finally {
      setRedeeming(false);
    }
  }

  // === ATTENDEE INFO — Readable card with redeem actions ===
  return (
    <div className="bg-white dark:bg-card rounded-2xl p-5 space-y-4 shadow-2xl max-w-sm w-full">
      {/* Attendee info with selfie */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-muted flex items-center justify-center">
          {attendee.selfieStorageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attendee.selfieStorageUrl}
              alt={attendee.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="h-10 w-10 text-gray-400" />
          )}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
          {attendee.name}
        </h3>
      </div>

      {/* Status items */}
      <div className="space-y-2">
        {/* Activity status */}
        {(stationType === "activity" || stationType === "both") && (
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              hasVisited
                ? "bg-gray-100 dark:bg-muted"
                : "bg-green-50 dark:bg-green-900/20"
            )}
          >
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Activity
            </span>
            {hasVisited ? (
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <XCircle className="h-4 w-4" /> Done
              </span>
            ) : (
              <span className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Available
              </span>
            )}
          </div>
        )}

        {/* Food status */}
        {foodItem && (stationType === "food" || stationType === "both") && (
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              hasVisited || foodLimitReached
                ? "bg-gray-100 dark:bg-muted"
                : "bg-green-50 dark:bg-green-900/20"
            )}
          >
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {foodItem}
            </span>
            {hasVisited ? (
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <XCircle className="h-4 w-4" /> Redeemed
              </span>
            ) : foodLimitReached ? (
              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Limit reached
              </span>
            ) : (
              <span className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Available
              </span>
            )}
          </div>
        )}

        {/* Food counter */}
        <div className="text-center text-xs text-gray-500 font-medium">
          Food: {attendee.totalFoodRedemptions || 0} of{" "}
          {attendee.maxFoodRedemptions || 8}
        </div>
      </div>

      {/* Action buttons — 48px minimum height for outdoor use */}
      <div className="space-y-2">
        {/* Both button — only for stations with both activity AND food available */}
        {canActivity && canFood && (
          <Button
            className="w-full min-h-[48px] text-base font-semibold"
            onClick={handleRedeemBoth}
            disabled={redeeming}
          >
            {redeeming ? "Processing..." : "Redeem Both"}
          </Button>
        )}

        {/* Food-only button */}
        {canFood && (
          <Button
            className="w-full min-h-[48px] text-base font-semibold"
            variant={canActivity ? "outline" : "default"}
            onClick={() => handleRedeem(foodItem!)}
            disabled={redeeming}
          >
            {redeeming ? "Processing..." : `Redeem Food`}
          </Button>
        )}

        {/* Activity-only button */}
        {canActivity && (
          <Button
            className="w-full min-h-[48px] text-base font-semibold"
            variant={canFood ? "outline" : "default"}
            onClick={() => handleRedeem("activity")}
            disabled={redeeming}
          >
            {redeeming ? "Processing..." : "Redeem Activity"}
          </Button>
        )}

        {hasVisited && (
          <p className="text-center text-sm font-medium text-gray-400">
            Already visited this station
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="lg"
        className="w-full min-h-[48px] text-base"
        onClick={onDismiss}
      >
        Cancel
      </Button>
    </div>
  );
}
