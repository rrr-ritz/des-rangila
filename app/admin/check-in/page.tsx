"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { SelfieCapture } from "@/components/face/SelfieCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { UserPlus, Loader2, Search } from "lucide-react";

interface AttendeeRow {
  id: string;
  name: string;
  email: string;
  pin: string;
  qrPayload: string;
  checkedIn: boolean;
}

interface CreatedAttendee {
  id: string;
  name: string;
  phone: string;
  email: string;
  pin: string;
  qrPayload: string;
  checkedIn: boolean;
}

type Mode = "pre-order" | "walk-in";
type Step = "form" | "creating" | "selfie" | "confirm";

export default function CheckInPage() {
  const { user } = useAuth();

  const [mode, setMode] = useState<Mode>("pre-order");
  const [allAttendees, setAllAttendees] = useState<AttendeeRow[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(true);

  // Pre-order state
  const [nameQuery, setNameQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AttendeeRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<AttendeeRow | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Walk-in state
  const [walkInName, setWalkInName] = useState("");

  // Shared state
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState("");
  const [attendee, setAttendee] = useState<CreatedAttendee | null>(null);
  const [smsStatus, setSmsStatus] = useState<"pending" | "sent" | "error" | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [authToken, setAuthToken] = useState<string>("");

  // Load all attendees on mount for autocomplete
  const fetchAllAttendees = useCallback(async () => {
    if (!user) return;
    setLoadingAttendees(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/attendees?limit=200", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllAttendees(data.attendees || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAttendees(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllAttendees();
  }, [fetchAllAttendees]);

  // Filter suggestions as user types
  useEffect(() => {
    if (mode !== "pre-order" || !nameQuery.trim() || selectedAttendee) {
      setSuggestions([]);
      return;
    }
    const q = nameQuery.toLowerCase();
    const matches = allAttendees.filter(
      (a) => a.name.toLowerCase().includes(q) && !a.checkedIn
    );
    setSuggestions(matches.slice(0, 8));
  }, [nameQuery, allAttendees, mode, selectedAttendee]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function reset() {
    setStep("form");
    setNameQuery("");
    setWalkInName("");
    setPhone("");
    setError("");
    setAttendee(null);
    setSelectedAttendee(null);
    setSmsStatus(null);
    setAlreadyExists(false);
    setSuggestions([]);
    // Refresh attendees to get updated checkedIn state
    fetchAllAttendees();
  }

  function selectAttendee(a: AttendeeRow) {
    setSelectedAttendee(a);
    setNameQuery(a.name);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  // Pre-order check-in
  async function handlePreOrderCheckIn() {
    if (!user || !selectedAttendee) return;

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Phone number is required");
      return;
    }

    setError("");
    setStep("creating");

    try {
      const token = await user.getIdToken();
      setAuthToken(token);
      const res = await fetch(`/api/attendees/${selectedAttendee.id}/check-in`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Already checked in — show as existing
          setAttendee({
            id: selectedAttendee.id,
            name: selectedAttendee.name,
            phone: phone,
            email: selectedAttendee.email,
            pin: selectedAttendee.pin,
            qrPayload: selectedAttendee.qrPayload,
            checkedIn: true,
          });
          setAlreadyExists(true);
          setStep("selfie");
          return;
        }
        setError(data.error || "Check-in failed");
        setStep("form");
        return;
      }

      setAttendee({
        id: selectedAttendee.id,
        name: selectedAttendee.name,
        phone: phone,
        email: selectedAttendee.email,
        pin: selectedAttendee.pin,
        qrPayload: selectedAttendee.qrPayload,
        checkedIn: true,
      });

      if (data.smsSent) {
        setSmsStatus("sent");
      } else if (data.smsError) {
        setSmsStatus("error");
      }

      setStep("selfie");
    } catch {
      setError("Network error. Please try again.");
      setStep("form");
    }
  }

  // Walk-in registration
  async function handleWalkIn() {
    if (!user) return;
    if (!walkInName.trim()) {
      setError("Name is required");
      return;
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Phone number is required");
      return;
    }

    setError("");
    setStep("creating");

    try {
      const token = await user.getIdToken();
      setAuthToken(token);
      const res = await fetch("/api/attendees/walk-in", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: walkInName.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setStep("form");
        return;
      }

      setAttendee(data.attendee);
      setAlreadyExists(data.alreadyExists || false);

      if (data.smsSent) {
        setSmsStatus("sent");
      } else if (data.smsError) {
        setSmsStatus("error");
      }

      setStep("selfie");
    } catch {
      setError("Network error. Please try again.");
      setStep("form");
    }
  }

  const passUrl = attendee
    ? `https://des-rangila.vercel.app/pass/${attendee.qrPayload}`
    : "";

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Check-in</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "pre-order" ? "Check in pre-registered attendees" : "Register walk-in attendees"}
        </p>
      </div>

      {/* Mode toggle */}
      {step === "form" && (
        <div className="flex rounded-lg border overflow-hidden mb-6">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "pre-order"
                ? "bg-[#483932] text-[#F5E6C8]"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => { setMode("pre-order"); setError(""); }}
          >
            Pre-Order
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "walk-in"
                ? "bg-[#483932] text-[#F5E6C8]"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => { setMode("walk-in"); setError(""); }}
          >
            Walk-In
          </button>
        </div>
      )}

      {/* Step 1: Form */}
      {step === "form" && mode === "pre-order" && (
        <div className="space-y-4">
          {/* Name autocomplete */}
          <div className="space-y-2">
            <label htmlFor="checkin-name" className="text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={suggestionsRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="checkin-name"
                placeholder={loadingAttendees ? "Loading attendees..." : "Search by name..."}
                className="pl-9"
                value={nameQuery}
                onChange={(e) => {
                  setNameQuery(e.target.value);
                  setSelectedAttendee(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                disabled={loadingAttendees}
                autoFocus
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((a) => (
                    <button
                      key={a.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center justify-between"
                      onClick={() => selectAttendee(a)}
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{a.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedAttendee && (
              <p className="text-xs text-green-600">
                Selected: {selectedAttendee.name} ({selectedAttendee.email})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="checkin-phone" className="text-sm font-medium">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <Input
              id="checkin-phone"
              type="tel"
              placeholder="(301) 555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            size="lg"
            onClick={handlePreOrderCheckIn}
            disabled={!selectedAttendee}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Check In
          </Button>
        </div>
      )}

      {step === "form" && mode === "walk-in" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="walkin-name" className="text-sm font-medium">
              Name <span className="text-red-500">*</span>
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
            <label htmlFor="walkin-phone" className="text-sm font-medium">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <Input
              id="walkin-phone"
              type="tel"
              placeholder="(301) 555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" size="lg" onClick={handleWalkIn}>
            <UserPlus className="h-4 w-4 mr-2" />
            Create Passport
          </Button>
        </div>
      )}

      {/* Step 2: Creating */}
      {step === "creating" && (
        <div className="text-center py-12 space-y-4">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
          <div>
            <h3 className="font-semibold">
              {mode === "pre-order" ? "Checking in..." : "Creating passport..."}
            </h3>
            <p className="text-sm text-muted-foreground">
              {mode === "pre-order" ? "Processing check-in" : "Generating PIN and QR code"}
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Selfie */}
      {step === "selfie" && attendee && (
        <SelfieCapture
          attendeeId={attendee.id}
          attendeeName={attendee.name}
          authToken={authToken}
          onComplete={() => setStep("confirm")}
          onSkip={() => setStep("confirm")}
        />
      )}

      {/* Step 4: Confirmation */}
      {step === "confirm" && attendee && (
        <div className="space-y-6 text-center rounded-xl p-5" style={{ backgroundColor: "#FDF8F0" }}>
          {alreadyExists && (
            <div className="text-sm px-4 py-2 rounded-md text-left" style={{ backgroundColor: "rgba(212,145,59,0.1)", color: "#705f3d" }}>
              This person is already registered. Showing existing passport.
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs tracking-[2px] uppercase text-muted-foreground">
              {mode === "pre-order" ? "Checked in" : "Passport created for"}
            </p>
            <p className="font-display text-xl font-medium" style={{ color: "#483932" }}>
              {attendee.name}
            </p>
          </div>

          <div className="inline-block p-4 bg-white rounded-xl shadow-md border" style={{ borderColor: "#E8DFD0" }}>
            <QRCodeSVG
              value={passUrl}
              size={250}
              level="M"
              includeMargin={false}
            />
          </div>

          <p className="text-sm font-medium" style={{ color: "#483932" }}>
            Scan this QR code to open your digital passport
          </p>

          <div className="rounded-xl p-4 border" style={{ backgroundColor: "#FFFCF7", borderColor: "#E8DFD0" }}>
            <p className="text-[10px] tracking-[2px] uppercase text-muted-foreground mb-2">Your PIN</p>
            <p className="text-4xl font-mono font-bold tracking-[0.3em]" style={{ color: "#D4913B" }}>
              {attendee.pin}
            </p>
          </div>

          {smsStatus === "sent" && (
            <p className="text-xs text-green-600">
              Passport link also texted to {attendee.phone}
            </p>
          )}
          {smsStatus === "error" && (
            <p className="text-xs" style={{ color: "#D4913B" }}>
              SMS delivery pending — use the QR code above
            </p>
          )}

          <Button
            className="w-full text-white"
            size="lg"
            onClick={reset}
            style={{ backgroundColor: "#483932" }}
          >
            Next Attendee
          </Button>
        </div>
      )}
    </div>
  );
}
