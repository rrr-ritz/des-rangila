"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { QRScanner } from "@/components/scanner/QRScanner";
import { ScanResult } from "@/components/scanner/ScanResult";
import { OfflineBanner } from "@/components/scanner/OfflineBanner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Volume2, VolumeX, XCircle } from "lucide-react";
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
  checkedIn: boolean;
  stampsCollected: string[];
  totalFoodRedemptions: number;
  maxFoodRedemptions: number;
  selfieStorageUrl?: string;
}

// Hardcoded station list for offline fallback
// Stations with food also have cultural activities ("both")
// Activity-only stations have no food service
const STATIONS: StationInfo[] = [
  { id: "registration", name: "Check-In", type: "registration", foodItem: null },
  { id: "jammu-kashmir", name: "Jammu & Kashmir + Ladakh", type: "activity", foodItem: null },
  { id: "himachal-uttarakhand", name: "Himachal + Uttarakhand", type: "activity", foodItem: null },
  { id: "punjab", name: "Punjab", type: "both", foodItem: "Paneer Tikka" },
  { id: "haryana-rajasthan", name: "Haryana + Rajasthan", type: "activity", foodItem: null },
  { id: "gujarat", name: "Gujarat", type: "activity", foodItem: null },
  { id: "maharashtra", name: "Maharashtra", type: "both", foodItem: "Vada Pav" },
  { id: "central-india", name: "Central India", type: "both", foodItem: "Chai Latte Samples" },
  { id: "odisha", name: "Odisha", type: "activity", foodItem: null },
  { id: "west-bengal", name: "West Bengal", type: "activity", foodItem: null },
  { id: "seven-sisters-sikkim", name: "Seven Sisters + Sikkim", type: "both", foodItem: "Momos" },
  { id: "andhra-telangana", name: "Andhra Pradesh + Telangana", type: "both", foodItem: "Biryani" },
  { id: "karnataka", name: "Karnataka", type: "both", foodItem: "Idli" },
  { id: "tamil-nadu", name: "Tamil Nadu", type: "both", foodItem: "Uthappam" },
  { id: "kerala", name: "Kerala", type: "activity", foodItem: null },
  { id: "motion-cafe", name: "Motion Cafe", type: "food", foodItem: "Drinks" },
  { id: "photo-booth", name: "Photo Booth", type: "photo-booth", foodItem: null },
];

export default function ScanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [station, setStation] = useState<StationInfo | null>(null);
  const [volunteerName, setVolunteerName] = useState<string>("");
  const [attendee, setAttendee] = useState<AttendeeInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Border flash for outdoor visual feedback
  const [borderFlash, setBorderFlash] = useState<"green" | "red" | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const pausedRef = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/staff");
    }
  }, [user, authLoading, router]);

  // Load sound preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("des-rangila-scan-sound");
      if (saved === "true") setSoundEnabled(true);
    } catch {
      // localStorage not available
    }
  }, []);

  // Load volunteer profile and assigned station
  useEffect(() => {
    if (!user) return;
    async function loadProfile() {
      try {
        const token = await user!.getIdToken();
        const res = await fetch("/api/volunteers/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setVolunteerName(data.name || "");
          if (data.currentStationId) {
            const matched = STATIONS.find((s) => s.id === data.currentStationId);
            if (matched) {
              setStation(matched);
            }
          }
        } else {
          setProfileError("Could not load your profile. Please contact an admin.");
        }
      } catch {
        setProfileError("Network error loading profile.");
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  // ---- SCAN HANDLER ----
  const handleScan = useCallback(
    async (rawPayload: string) => {
      if (!user || !station) return;
      if (pausedRef.current) return;

      pausedRef.current = true;

      // QR codes encode a full URL like https://des-rangila.vercel.app/pass/XXXX
      // Extract the qrPayload (last path segment) if it's a URL
      let payload = rawPayload;
      try {
        const passMatch = rawPayload.match(/\/pass\/([^/?#]+)/);
        if (passMatch) {
          payload = decodeURIComponent(passMatch[1]);
        }
      } catch {
        // Not a URL — use raw value
      }

      console.log("[scan] raw:", rawPayload, "→ payload:", payload);

      setBorderFlash("green");
      setTimeout(() => setBorderFlash(null), 600);

      try {
        let data: AttendeeInfo | undefined;

        try {
          const cached = await getAttendeeByQr(payload);
          if (cached) {
            data = cached as AttendeeInfo;
          }
        } catch {
          // IndexedDB not available
        }

        if (!data) {
          try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/attendees/by-qr/${encodeURIComponent(payload)}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              data = await res.json();
            }
          } catch {
            // Network error
          }
        }

        if (data) {
          setAttendee(data);
        } else {
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
  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  // No station assigned — show picker for dev account, error for others
  if (!station) {
    const isDevAccount = volunteerName === "Dev Test";

    if (isDevAccount) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-sm w-full">
            <h2 className="font-display text-lg font-medium text-[var(--color-primary)]">
              Dev Mode — Pick a Station
            </h2>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {STATIONS.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                  onClick={() => setStation(s)}
                >
                  <span className="font-medium">{s.name}</span>
                  {s.foodItem && <span className="text-muted-foreground ml-2">· {s.foodItem}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <h2 className="font-display text-lg font-medium text-[var(--color-primary)]">
            No Station Assigned
          </h2>
          <p className="text-sm text-muted-foreground">
            {profileError || "You haven't been assigned to a station yet. Please contact an admin."}
          </p>
        </div>
      </div>
    );
  }

  // ---- MAIN SCAN UI ----
  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto">
      {/* Full-screen border flash */}
      <div
        className={cn(
          "fixed inset-0 pointer-events-none z-30 transition-opacity duration-300",
          borderFlash ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 border-[6px]",
            borderFlash === "green" && "border-green-500 shadow-[inset_0_0_40px_rgba(34,197,94,0.3)]",
            borderFlash === "red" && "border-red-500 shadow-[inset_0_0_40px_rgba(239,68,68,0.3)]",
            !borderFlash && "border-transparent"
          )}
        />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b" style={{ backgroundColor: "#483932" }}>
        <div>
          <p className="font-display font-medium text-sm" style={{ color: "#F5E6C8" }}>{station.name}</p>
          <p className="text-xs" style={{ color: "#B4A689" }}>
            {volunteerName}{station.foodItem ? ` · ${station.foodItem}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSound}
            className="p-2 rounded-md hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title={soundEnabled ? "Sound on" : "Sound off"}
            aria-label={soundEnabled ? "Disable scan sound" : "Enable scan sound"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" style={{ color: "#F5E6C8" }} />
            ) : (
              <VolumeX className="h-4 w-4" style={{ color: "#8C7B6B" }} />
            )}
          </button>
        </div>
      </header>

      <OfflineBanner />

      {/* Scanner + overlays */}
      <div className="flex-1 p-4">
        <div className="relative">
          <QRScanner
            onScan={handleScan}
            paused={!!attendee || notFound}
          />

          {/* Attendee result overlay */}
          {attendee && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
              <ScanResult
                attendee={attendee}
                stationId={station.id}
                stationType={station.type}
                foodItem={station.foodItem}
                onRedeem={handleRedeem}
                onDismiss={handleDismiss}
                soundEnabled={soundEnabled}
              />
            </div>
          )}

          {/* Not found overlay */}
          {notFound && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-600/90 backdrop-blur-sm rounded-lg p-4">
              <div className="text-center text-white space-y-3">
                <XCircle className="h-20 w-20 mx-auto" strokeWidth={2.5} />
                <p className="text-xl font-bold">Not Found</p>
                <p className="text-sm opacity-80">QR code not recognized</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
