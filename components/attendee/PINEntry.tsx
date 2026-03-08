"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

interface PINEntryProps {
  onSubmit: (pin: string) => void;
  loading?: boolean;
  error?: string;
}

export function PINEntry({ onSubmit, loading, error }: PINEntryProps) {
  const [pin, setPin] = useState("");

  function handleKey(digit: string) {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        onSubmit(newPin);
      }
    }
  }

  function handleDelete() {
    setPin((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setPin("");
  }

  return (
    <div className="w-full max-w-xs mx-auto space-y-6" role="form" aria-label="PIN entry">
      {/* PIN display */}
      <div className="flex justify-center gap-2" aria-label={`PIN: ${pin.length} of 4 digits entered`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-mono font-bold transition-colors ${
              i < pin.length
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
            aria-hidden="true"
          >
            {i < pin.length ? pin[i] : ""}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Number pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <Button
            key={digit}
            variant="outline"
            className="h-14 text-xl font-semibold"
            onClick={() => handleKey(digit)}
            disabled={loading || pin.length >= 4}
            aria-label={`Digit ${digit}`}
          >
            {digit}
          </Button>
        ))}
        <Button
          variant="outline"
          className="h-14 text-sm"
          onClick={handleClear}
          disabled={loading}
          aria-label="Clear all digits"
        >
          Clear
        </Button>
        <Button
          variant="outline"
          className="h-14 text-xl font-semibold"
          onClick={() => handleKey("0")}
          disabled={loading || pin.length >= 4}
          aria-label="Digit 0"
        >
          0
        </Button>
        <Button
          variant="outline"
          className="h-14"
          onClick={handleDelete}
          disabled={loading || pin.length === 0}
          aria-label="Delete last digit"
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground text-center">
          Looking up your passport...
        </p>
      )}
    </div>
  );
}
