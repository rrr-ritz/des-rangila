"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Hash, UserPlus, ArrowRight, X } from "lucide-react";

interface IdentifiedAttendee {
  id: string;
  name: string;
  email: string;
}

interface AttendeeScannerProps {
  onIdentify: (attendees: IdentifiedAttendee[]) => void;
  onSkip: () => void;
}

export function AttendeeScanner({ onIdentify, onSkip }: AttendeeScannerProps) {
  const [mode, setMode] = useState<"choice" | "pin" | "adding">("choice");
  const [pin, setPin] = useState("");
  const [attendees, setAttendees] = useState<IdentifiedAttendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupByPin = async (pinValue: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendees/by-pin/${pinValue}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Attendee not found");
        return;
      }
      const attendee = await res.json();
      // Check for duplicate
      if (attendees.some((a) => a.id === attendee.id)) {
        setError("This attendee is already added");
        return;
      }
      setAttendees((prev) => [
        ...prev,
        { id: attendee.id, name: attendee.name, email: attendee.email },
      ]);
      setPin("");
      setMode("adding");
    } catch {
      setError("Failed to look up attendee");
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = () => {
    if (pin.length === 4) {
      lookupByPin(pin);
    }
  };

  const removeAttendee = (id: string) => {
    setAttendees((prev) => prev.filter((a) => a.id !== id));
  };

  const handleContinue = () => {
    onIdentify(attendees);
  };

  // Choice screen: PIN or Skip
  if (mode === "choice" && attendees.length === 0) {
    return (
      <div className="space-y-6 text-center max-w-sm mx-auto">
        <div>
          <h2 className="text-xl font-bold mb-2">Who&apos;s taking a photo?</h2>
          <p className="text-sm text-muted-foreground">
            Scan your QR code or enter your PIN so we can link photos to your profile
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full h-14 text-base"
            onClick={() => setMode("pin")}
          >
            <Hash className="h-5 w-5 mr-2" />
            Enter PIN
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={onSkip}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Skip — just take photos
          </Button>
        </div>
      </div>
    );
  }

  // PIN entry
  if (mode === "pin") {
    return (
      <div className="space-y-6 text-center max-w-sm mx-auto">
        <div>
          <h2 className="text-xl font-bold mb-2">Enter your PIN</h2>
          <p className="text-sm text-muted-foreground">
            The 4-digit PIN from your digital passport
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="0000"
            className="text-center text-2xl font-mono tracking-[0.5em] h-14"
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPin(val);
            }}
            autoFocus
          />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setMode(attendees.length > 0 ? "adding" : "choice");
                setPin("");
                setError(null);
              }}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={handlePinSubmit}
              disabled={pin.length !== 4 || loading}
            >
              {loading ? "Looking up..." : "Find Me"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Adding more people / ready screen
  return (
    <div className="space-y-6 max-w-sm mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-1">
          {attendees.length === 1
            ? `Hi, ${attendees[0].name}!`
            : `${attendees.length} people ready`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Ready for your photo?
        </p>
      </div>

      {/* Listed attendees */}
      <div className="space-y-2">
        {attendees.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <span className="text-sm font-medium">{a.name}</span>
              <button
                onClick={() => removeAttendee(a.id)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setMode("pin")}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add another person
        </Button>
        <Button className="w-full h-12 text-base" onClick={handleContinue}>
          <ArrowRight className="h-4 w-4 mr-2" />
          Ready — let&apos;s go!
        </Button>
      </div>
    </div>
  );
}
