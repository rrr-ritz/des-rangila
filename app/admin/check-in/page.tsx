"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { SelfieCapture } from "@/components/face/SelfieCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { UserPlus, Loader2 } from "lucide-react";

interface WalkInAttendee {
  id: string;
  name: string;
  phone: string;
  email: string;
  pin: string;
  qrPayload: string;
  checkedIn: boolean;
}

type Step = "form" | "creating" | "selfie" | "confirm";

export default function CheckInPage() {
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [attendee, setAttendee] = useState<WalkInAttendee | null>(null);
  const [smsStatus, setSmsStatus] = useState<"pending" | "sent" | "error" | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);

  function reset() {
    setStep("form");
    setName("");
    setEmail("");
    setPhone("");
    setError("");
    setAttendee(null);
    setSmsStatus(null);
    setAlreadyExists(false);
  }

  async function handleSubmit() {
    if (!user) return;
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setError("");
    setStep("creating");

    const phoneProvided = phone.replace(/\D/g, "").length >= 10;

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/attendees/walk-in", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phoneProvided ? phone.trim() : undefined,
          email: email.trim() || undefined,
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

      if (!phoneProvided) {
        setSmsStatus(null);
      } else if (data.smsSent) {
        setSmsStatus("sent");
      } else if (data.smsError) {
        setSmsStatus("error");
      } else {
        setSmsStatus("pending");
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
          Register walk-in attendees and create passports
        </p>
      </div>

      {/* Step 1: Form */}
      {step === "form" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="checkin-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="checkin-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="checkin-phone" className="text-sm font-medium">
              Phone Number <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              id="checkin-phone"
              type="tel"
              placeholder="(301) 555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="checkin-email" className="text-sm font-medium">
              Email <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              id="checkin-email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" size="lg" onClick={handleSubmit}>
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
            <h3 className="font-semibold">Creating passport...</h3>
            <p className="text-sm text-muted-foreground">
              Generating PIN and QR code
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Selfie */}
      {step === "selfie" && attendee && (
        <SelfieCapture
          attendeeId={attendee.id}
          attendeeName={attendee.name}
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
            <p className="text-xs tracking-[2px] uppercase text-muted-foreground">Passport created for</p>
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
          {smsStatus === "pending" && (
            <p className="text-xs text-muted-foreground">
              Sending text message...
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
