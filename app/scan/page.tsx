"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { QRScanner } from "@/components/scanner/QRScanner";
import { ScanResult } from "@/components/scanner/ScanResult";
import { OfflineBanner } from "@/components/scanner/OfflineBanner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Settings, Volume2, VolumeX, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAttendeeByQr, updateCachedAttendee } from "@/lib/offline/db";
import { cn } from "@/lib/utils";

interface StationInfo {
  id: string;
  name: string;
  type: string;
  foodItem: string | null;
}

interface AttendeeInfo {
  id: string;
  name: string;
  ticketTier: string;
  checkedIn: boolean;
  stampsCollected: string[];
  totalFoodRedemptions: number;
  maxFoodRedemptions: number;
}

export default function ScanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [station, setStation] = useState<StationInfo | null>(null);
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [attendee, setAttendee] = useState<AttendeeInfo | null>(null);
  const [showStationPicker, setShowStationPicker] = useState(false);

  // Border flash for outdoor visual feedback
  const [borderFlash, setBorderFlash] = useState<"green" | "red" | null>(
    null
  );
  // "Not found" overlay (auto-dismisses after 2s)
  const [notFound, setNotFound] = useState(false);
  // Sound toggle (persisted in localStorage)
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Use a ref for pause state so the QRScanner callback doesn't need
  // to recreate — the scanner stays alive and checks this ref.
  const pausedRef = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/volunteer/register");
    }
  }, [user, authLoading, router]);

  // Load sound preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("des-rangila-scan-sound");
      if (saved === "true") setSoundEnabled(true);
    } catch {
      // localStorage not available
    }
  }, []);

  // Load stations
  useEffect(() => {
    if (!user) return;
    async function loadStations() {
      try {
        const token = await user!.getIdToken();
        const res = await fetch("/api/inventory", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          // If we can't load stations from API, use defaults
        }
      } catch {
        // Offline or no stations configured yet
      }

      // Default stations for initial setup
      setStations([
        { id: "registration", name: "Registration", type: "registration", foodItem: null },
        { id: "jammu-kashmir", name: "Jammu & Kashmir", type: "activity", foodItem: null },
        { id: "punjab", name: "Punjab", type: "both", foodItem: "Mango Lassi" },
        { id: "rajasthan", name: "Rajasthan", type: "activity", foodItem: null },
        { id: "gujarat", name: "Gujarat", type: "both", foodItem: "Chai" },
        { id: "maharashtra", name: "Maharashtra", type: "both", foodItem: "Vada Pav" },
        { id: "goa", name: "Goa", type: "activity", foodItem: null },
        { id: "karnataka", name: "Karnataka", type: "both", foodItem: "Idli" },
        { id: "kerala", name: "Kerala", type: "activity", foodItem: null },
        { id: "tamil-nadu", name: "Tamil Nadu", type: "both", foodItem: "Uthappam" },
        { id: "andhra-pradesh", name: "Andhra Pradesh", type: "both", foodItem: "Biryani" },
        { id: "telangana", name: "Telangana", type: "activity", foodItem: null },
        { id: "odisha", name: "Odisha", type: "activity", foodItem: null },
        { id: "west-bengal", name: "West Bengal", type: "both", foodItem: "Momos" },
        { id: "northeast", name: "Northeast India", type: "activity", foodItem: null },
        { id: "photo-booth", name: "Photo Booth", type: "photo-booth", foodItem: null },
      ]);

      // Show station picker if no station selected
      setShowStationPicker(true);
    }
    loadStations();
  }, [user]);

  // ---- SCAN HANDLER ----
  // Flow: QR decoded → haptic (in QRScanner) → green border flash →
  //       IndexedDB lookup (sub-50ms) → fallback to API → show result
  const handleScan = useCallback(
    async (payload: string) => {
      if (!user || !station) return;
      if (pausedRef.current) return;

      // Pause immediately so we don't process another scan
      pausedRef.current = true;

      // Green border flash — visible even in bright sunlight
      setBorderFlash("green");
      setTimeout(() => setBorderFlash(null), 600);

      try {
        let data: AttendeeInfo | undefined;

        // 1. Try IndexedDB first — should resolve in under 50ms
        try {
          const cached = await getAttendeeByQr(payload);
          if (cached) {
            data = cached as AttendeeInfo;
          }
        } catch {
          // IndexedDB not available or empty
        }

        // 2. Fallback to API if not found locally
        if (!data) {
          try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/attendees/by-qr/${payload}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              data = await res.json();
            }
          } catch {
            // Network error — we'll show not-found
          }
        }

        if (data) {
          setAttendee(data);
          // pausedRef stays true — will be reset in handleDismiss
        } else {
          // Attendee not found — show brief error overlay
          setBorderFlash("red");
          setTimeout(() => setBorderFlash(null), 600);
          try {
            navigator.vibrate([50, 50, 50]);
          } catch {
            // Not supported
          }
          setNotFound(true);
          setTimeout(() => {
            setNotFound(false);
            pausedRef.current = false;
          }, 2000);
        }
      } catch {
        // Unexpected error — resume scanning
        pausedRef.current = false;
      }
    },
    [user, station]
  );

  // ---- REDEEM HANDLER ----
  async function handleRedeem(itemType: string) {
    if (!user || !attendee || !station) throw new Error("Not ready");

    const token = await user.getIdToken();
    const res = await fetch("/api/redemptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attendeeId: attendee.id,
        stationId: station.id,
        itemType,
        idempotencyKey: crypto.randomUUID(),
        syncedFromOffline: false,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Redemption failed");
    }

    // Update IndexedDB cache so subsequent scans of the same
    // attendee show the correct stamp count (even offline).
    try {
      await updateCachedAttendee(attendee.id, {
        stampsCollected: [...(attendee.stampsCollected || []), station.id],
        totalFoodRedemptions:
          itemType !== "activity"
            ? (attendee.totalFoodRedemptions || 0) + 1
            : attendee.totalFoodRedemptions || 0,
      });
    } catch {
      // IndexedDB update failed — not critical
    }
  }

  // ---- DISMISS HANDLER ----
  // Clears the result overlay → scanner immediately resumes.
  // No tap required — success auto-dismisses after 3s.
  function handleDismiss() {
    setAttendee(null);
    pausedRef.current = false;
  }

  function toggleSound() {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    try {
      localStorage.setItem("des-rangila-scan-sound", String(newVal));
    } catch {
      // localStorage not available
    }
  }

  // ---- LOADING / AUTH STATES ----
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  // ---- STATION PICKER ----
  if (showStationPicker && !station) {
    return (
      <div className="min-h-screen p-4 max-w-sm mx-auto">
        <h1 className="text-xl font-bold text-center mb-1">Select Station</h1>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Choose the station you&apos;re volunteering at.
        </p>
        <div className="space-y-2">
          {stations.map((s) => (
            <button
              key={s.id}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() => {
                setStation(s);
                setShowStationPicker(false);
              }}
            >
              <p className="font-medium text-sm">{s.name}</p>
              {s.foodItem && (
                <p className="text-xs text-muted-foreground">{s.foodItem}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- MAIN SCAN UI ----
  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto">
      {/* Full-screen border flash — visible in direct sunlight */}
      <div
        className={cn(
          "fixed inset-0 pointer-events-none z-50 transition-opacity duration-300",
          borderFlash
            ? "opacity-100"
            : "opacity-0"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 border-[6px]",
            borderFlash === "green" &&
              "border-green-500 shadow-[inset_0_0_40px_rgba(34,197,94,0.3)]",
            borderFlash === "red" &&
              "border-red-500 shadow-[inset_0_0_40px_rgba(239,68,68,0.3)]",
            !borderFlash && "border-transparent"
          )}
        />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b">
        <div>
          <p className="font-semibold text-sm">{station?.name}</p>
          {station?.foodItem && (
            <p className="text-xs text-muted-foreground">
              {station.foodItem}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Sound toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-md hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
            title={soundEnabled ? "Sound on" : "Sound off"}
            aria-label={
              soundEnabled ? "Disable scan sound" : "Enable scan sound"
            }
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
          {/* Station picker */}
          <button
            onClick={() => {
              setStation(null);
              setShowStationPicker(true);
            }}
            className="p-2 rounded-md hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Change station"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <OfflineBanner />

      {/* Scanner + overlays */}
      <div className="flex-1 p-4">
        <div className="relative">
          {/* QR Scanner — ALWAYS running, never unmounted while on this screen */}
          <QRScanner
            onScan={handleScan}
            paused={!!attendee || notFound}
          />

          {/* Attendee result overlay — floats on top of the running scanner */}
          {attendee && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-lg p-4">
              <ScanResult
                attendee={attendee}
                stationId={station!.id}
                stationType={station!.type}
                foodItem={station!.foodItem}
                onRedeem={handleRedeem}
                onDismiss={handleDismiss}
                soundEnabled={soundEnabled}
              />
            </div>
          )}

          {/* "Not found" error overlay — auto-dismisses after 2 seconds */}
          {notFound && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-600/90 backdrop-blur-sm rounded-lg p-4">
              <div className="text-center text-white space-y-3">
                <XCircle className="h-20 w-20 mx-auto" strokeWidth={2.5} />
                <p className="text-xl font-bold">Not Found</p>
                <p className="text-sm opacity-80">
                  QR code not recognized
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
