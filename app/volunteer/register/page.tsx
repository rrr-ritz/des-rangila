"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { EventHeader } from "@/components/shared/EventHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = "phone" | "verify" | "profile" | "done";

export default function VolunteerRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode() {
    setError("");
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase not configured");

      // Initialize RecaptchaVerifier
      if (!(window as unknown as Record<string, unknown>).recaptchaVerifier) {
        (window as unknown as Record<string, unknown>).recaptchaVerifier =
          new RecaptchaVerifier(auth, "recaptcha-container", {
            size: "invisible",
          });
      }

      const verifier = (
        window as unknown as Record<string, unknown>
      ).recaptchaVerifier as RecaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phone, verifier);
      setConfirmation(result);
      setStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!confirmation) return;
    setError("");
    setLoading(true);

    try {
      await confirmation.confirm(code);
      setStep("profile");
    } catch {
      setError("Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProfile() {
    setError("");
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) throw new Error("Not authenticated");

      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/volunteers/register", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, phone }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }

      setStep("done");
      setTimeout(() => router.push("/scan"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <EventHeader className="mb-8" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Volunteer Registration</CardTitle>
          <CardDescription>
            {step === "phone" && "Enter your phone number to get started."}
            {step === "verify" && "Enter the 6-digit code sent to your phone."}
            {step === "profile" && "Almost done! Enter your name."}
            {step === "done" && "You're all set!"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                className="w-full"
                onClick={handleSendCode}
                disabled={loading || !phone}
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </Button>
              <div id="recaptcha-container" />
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-center text-lg tracking-widest font-mono"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                className="w-full"
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
              >
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </div>
          )}

          {step === "profile" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                className="w-full"
                onClick={handleCreateProfile}
                disabled={loading || !name}
              >
                {loading ? "Creating profile..." : "Complete Registration"}
              </Button>
            </div>
          )}

          {step === "done" && (
            <div className="text-center space-y-3">
              <div className="text-4xl">&#x2705;</div>
              <p className="font-medium">Registration complete!</p>
              <p className="text-sm text-muted-foreground">
                Redirecting to the scanner...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
