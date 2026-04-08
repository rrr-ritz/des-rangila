"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { QRScanner } from "@/components/scanner/QRScanner";
import { ScanResult } from "@/components/scanner/ScanResult";
import { OfflineBanner } from "@/components/scanner/OfflineBanner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { SelfieCapture } from "@/components/face/SelfieCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Volume2, VolumeX, XCircle, UserPlus, Check, Loader2, ArrowLeft } from "lucide-react";
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
}

interface WalkInAttendee {
  id: string;
  name: string;
  email: string;
  pin: string;
  qrPayload: string;
  checkedIn: boolean;
}

type WalkInStep = "form" | "creating" | "selfie" | "done";

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

  // ---- Walk-in Registration State ----
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInStep, setWalkInStep] = useState<WalkInStep>("form");
  const [walkInName, setWalkInName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInError, setWalkInError] = useState("");
  const [walkInAttendee, setWalkInAttendee] = useState<WalkInAttendee | null>(null);
  const [walkInEmailSent, setWalkInEmailSent] = useState(false);
  const [walkInAlreadyExists, setWalkInAlreadyExists] = useState(false);

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
        { id: "registration", name: "Check-In", type: "registration", foodItem: null },
        { id: "jammu-kashmir", name: "Jammu & Kashmir + Ladakh", type: "activity", foodItem: null },
        { id: "himachal-uttarakhand", name: "Himachal + Uttarakhand", type: "activity", foodItem: null },
        { id: "punjab", name: "Punjab", type: "food", foodItem: "Paneer Tikka" },
        { id: "haryana-rajasthan", name: "Haryana + Rajasthan", type: "activity", foodItem: null },
        { id: "gujarat", name: "Gujarat", type: "activity", foodItem: null },
        { id: "maharashtra", name: "Maharashtra", type: "food", foodItem: "Vada Pav" },
        { id: "central-india", name: "Central India", type: "food", foodItem: "Chai Latte Samples" },
        { id: "odisha", name: "Odisha", type: "activity", foodItem: null },
        { id: "west-bengal", name: "West Bengal", type: "activity", foodItem: null },
        { id: "seven-sisters-sikkim", name: "Seven Sisters + Sikkim", type: "food", foodItem: "Momos" },
        { id: "andhra-telangana", name: "Andhra Pradesh + Telangana", type: "food", foodItem: "Biryani" },
        { id: "karnataka", name: "Karnataka", type: "food", foodItem: "Idli" },
        { id: "tamil-nadu", name: "Tamil Nadu", type: "food", foodItem: "Uthappam" },
        { id: "kerala", name: "Kerala", type: "activity", foodItem: null },
        { id: "motion-cafe", name: "Motion Cafe", type: "food", foodItem: "Drinks" },
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

  // ---- WALK-IN REGISTRATION HANDLERS ----
  function openWalkIn() {
    setShowWalkIn(true);
    setWalkInStep("form");
    setWalkInName("");
    setWalkInEmail("");
    setWalkInError("");
    setWalkInAttendee(null);
    setWalkInEmailSent(false);
    setWalkInAlreadyExists(false);
    pausedRef.current = true;
  }

  function closeWalkIn() {
    setShowWalkIn(false);
    setWalkInStep("form");
    setWalkInName("");
    setWalkInEmail("");
    setWalkInError("");
    setWalkInAttendee(null);
    pausedRef.current = false;
  }

  async function handleWalkInSubmit() {
    if (!user) return;
    if (!walkInName.trim()) {
      setWalkInError("Name is required");
      return;
    }
    if (!walkInEmail.trim() || !walkInEmail.includes("@")) {
      setWalkInError("Valid email is required");
      return;
    }

    setWalkInError("");
    setWalkInStep("creating");

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/attendees/walk-in", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: walkInName.trim(),
          email: walkInEmail.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setWalkInError(data.error || "Registration failed");
        setWalkInStep("form");
        return;
      }

      setWalkInAttendee(data.attendee);
      setWalkInEmailSent(data.emailSent || false);
      setWalkInAlreadyExists(data.alreadyExists || false);

      // Move to selfie capture step
      setWalkInStep("selfie");
    } catch {
      setWalkInError("Network error. Please try again.");
      setWalkInStep("form");
    }
  }

  function handleSelfieComplete() {
    setWalkInStep("done");
  }

  function handleSelfieSkip() {
    setWalkInStep("done");
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

  // ---- WALK-IN REGISTRATION UI ----
  if (showWalkIn) {
    return (
      <div className="min-h-screen flex flex-col max-w-sm mx-auto">
        <header className="flex items-center gap-3 p-3 border-b">
          <button
            onClick={closeWalkIn}
            className="p-2 rounded-md hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Back to scanner"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="font-semibold text-sm">Walk-in Registration</p>
            <p className="text-xs text-muted-foreground">Create a new passport</p>
          </div>
        </header>

        <div className="flex-1 p-4">
          {/* Step 1: Name + Email Form */}
          {walkInStep === "form" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="walkin-name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="walkin-name"
                  placeholder="Full name"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="walkin-email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="walkin-email"
                  type="email"
                  placeholder="email@example.com"
                  value={walkInEmail}
                  onChange={(e) => setWalkInEmail(e.target.value)}
                />
              </div>

              {walkInError && (
                <p className="text-sm text-destructive">{walkInError}</p>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleWalkInSubmit}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Create Passport
              </Button>
            </div>
          )}

          {/* Step 2: Creating... */}
          {walkInStep === "creating" && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <div>
                <h3 className="font-semibold">Creating passport...</h3>
                <p className="text-sm text-muted-foreground">
                  Generating PIN and QR code
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Selfie Capture */}
          {walkInStep === "selfie" && walkInAttendee && (
            <div className="space-y-4">
              {walkInAlreadyExists && (
                <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-sm px-4 py-2 rounded-md">
                  This email is already registered. Showing existing passport.
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Passport created for</p>
                <p className="font-semibold text-lg">{walkInAttendee.name}</p>
                <p className="text-2xl font-mono font-bold text-primary tracking-[0.3em]">
                  {walkInAttendee.pin}
                </p>
                {walkInEmailSent && (
                  <p className="text-xs text-green-600">
                    Pass email sent to {walkInAttendee.email}
                  </p>
                )}
              </div>

              <SelfieCapture
                attendeeId={walkInAttendee.id}
                attendeeName={walkInAttendee.name}
                onComplete={handleSelfieComplete}
                onSkip={handleSelfieSkip}
              />
            </div>
          )}

          {/* Step 4: Done */}
          {walkInStep === "done" && walkInAttendee && (
            <div className="text-center py-12 space-y-6">
              <Check className="h-16 w-16 mx-auto text-green-500" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">All set!</h3>
                <p className="text-sm text-muted-foreground">
                  {walkInAttendee.name} is checked in and ready to go.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-xs text-muted-foreground">PIN</p>
                <p className="text-3xl font-mono font-bold text-primary tracking-[0.3em]">
                  {walkInAttendee.pin}
                </p>
                {walkInEmailSent && (
                  <p className="text-xs text-green-600">
                    Digital passport emailed to {walkInAttendee.email}
                  </p>
                )}
              </div>

              <Button className="w-full" size="lg" onClick={closeWalkIn}>
                Done — Back to Scanner
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- MAIN SCAN UI ----
  const isCheckIn = station?.type === "registration";

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

      {/* Walk-in Registration button — only shown at Check-In station */}
      {isCheckIn && (
        <div className="px-4 pt-3">
          <Button
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            size="lg"
            onClick={openWalkIn}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Walk-in Registration
          </Button>
        </div>
      )}

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
