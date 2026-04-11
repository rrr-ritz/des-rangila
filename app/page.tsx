"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PINEntry } from "@/components/attendee/PINEntry";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePinSubmit(pin: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/attendees/by-pin/${pin}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Invalid PIN");
        setLoading(false);
        return;
      }

      router.push(`/me?pin=${pin}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--color-background)]">
      <div className="w-full max-w-sm space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl font-medium text-[var(--color-primary)]">
            Des Rangila
          </h1>
          <p
            className="text-xs tracking-[4px] uppercase"
            style={{ color: "#705f3d" }}
          >
            Tour of India
          </p>
          <div
            className="mx-auto mt-3 h-[1px] w-16"
            style={{ backgroundColor: "#D4913B" }}
          />
        </div>

        {/* PIN Entry Card */}
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <div className="bg-card p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-base font-medium mb-1">
                Enter your passport PIN
              </h2>
              <p className="text-sm text-muted-foreground">
                Your 4-digit PIN was given at check-in.
              </p>
            </div>
            <PINEntry onSubmit={handlePinSubmit} loading={loading} error={error} />
          </div>
        </div>

        {/* Footer links */}
        <div className="text-center space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Indian Student Association · University of Maryland
          </p>
          <a
            href="/staff"
            className="inline-block text-xs text-muted-foreground hover:text-[var(--color-primary)] transition-colors underline underline-offset-2"
          >
            Staff login &rarr;
          </a>
        </div>
      </div>
    </main>
  );
}
