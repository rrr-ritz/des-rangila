"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signInAdmin } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VolunteerStep = "phone" | "verify" | "profile" | "done";

export default function StaffPage() {
  const router = useRouter();

  // ---- Volunteer state ----
  const [volStep, setVolStep] = useState<VolunteerStep>("phone");
  const [volPhone, setVolPhone] = useState("");
  const [volCode, setVolCode] = useState("");
  const [volName, setVolName] = useState("");
  const [volConfirmation, setVolConfirmation] = useState<ConfirmationResult | null>(null);
  const [volLoading, setVolLoading] = useState(false);
  const [volError, setVolError] = useState("");

  // ---- Admin state ----
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  // ---- Volunteer handlers ----
  function formatE164(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (raw.startsWith("+")) return raw.replace(/[^\d+]/g, "");
    return `+1${digits}`;
  }

  async function handleVolSendCode() {
    setVolError("");
    setVolLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase not configured");
      const e164Phone = formatE164(volPhone);

      // Dev bypass: skip SMS entirely for test number
      if (e164Phone === "+11111111111") {
        try {
          const res = await fetch("/api/dev-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: "+11111111111" }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Dev login API failed");
          }
          const { customToken } = await res.json();
          await signInWithCustomToken(auth, customToken);
          setVolStep("done");
          setTimeout(() => router.push("/scan"), 1000);
        } catch (err) {
          setVolError(
            `Dev login failed: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
        setVolLoading(false);
        return;
      }

      if (!(window as unknown as Record<string, unknown>).recaptchaVerifier) {
        (window as unknown as Record<string, unknown>).recaptchaVerifier =
          new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      const verifier = (window as unknown as Record<string, unknown>).recaptchaVerifier as RecaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, e164Phone, verifier);
      setVolConfirmation(result);
      setVolStep("verify");
    } catch (e) {
      setVolError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setVolLoading(false);
    }
  }

  async function handleVolVerifyCode() {
    if (!volConfirmation) return;
    setVolError("");
    setVolLoading(true);
    try {
      await volConfirmation.confirm(volCode);

      // Check if volunteer already registered (returning volunteer)
      const auth = getFirebaseAuth();
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch("/api/volunteers/register", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "", phone: volPhone }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.existing) {
            setVolStep("done");
            setTimeout(() => router.push("/scan"), 1500);
            return;
          }
        }
      }

      setVolStep("profile");
    } catch {
      setVolError("Invalid verification code. Please try again.");
    } finally {
      setVolLoading(false);
    }
  }

  async function handleVolCreateProfile() {
    setVolError("");
    setVolLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) throw new Error("Not authenticated");
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/volunteers/register", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: volName, phone: volPhone }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }
      setVolStep("done");
      setTimeout(() => router.push("/scan"), 2000);
    } catch (e) {
      setVolError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setVolLoading(false);
    }
  }

  // ---- Admin handler ----
  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      await signInAdmin(adminEmail, adminPassword);
      router.push("/admin");
    } catch {
      setAdminError("Invalid email or password.");
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--color-background)]">
      <div className="w-full max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-medium text-[var(--color-primary)]">
            Staff Login
          </h1>
          <p className="text-sm text-muted-foreground">
            Des Rangila — Tour of India
          </p>
          <div className="mx-auto mt-2 h-[1px] w-12" style={{ backgroundColor: "#D4913B" }} />
        </div>

        {/* Two panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ---- Volunteer Panel ---- */}
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="bg-[var(--color-primary)] px-5 py-4">
              <h2 className="font-display text-lg text-[var(--color-text-on-primary)]">
                Volunteer
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#B4A689" }}>
                Phone verification
              </p>
            </div>
            <div className="bg-card p-5">
              {volStep === "phone" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vol-phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center justify-center px-3 rounded-md border bg-muted text-sm font-medium text-muted-foreground shrink-0">
                        +1
                      </div>
                      <Input
                        id="vol-phone"
                        type="tel"
                        inputMode="numeric"
                        placeholder="(555) 000-0000"
                        value={volPhone}
                        onChange={(e) => setVolPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  {volError && <p className="text-sm text-destructive">{volError}</p>}
                  <Button className="w-full" onClick={handleVolSendCode} disabled={volLoading || !volPhone}>
                    {volLoading ? "Sending..." : "Send Verification Code"}
                  </Button>
                  <div id="recaptcha-container" />
                </div>
              )}

              {volStep === "verify" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vol-code">Verification Code</Label>
                    <Input
                      id="vol-code"
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={volCode}
                      onChange={(e) => setVolCode(e.target.value)}
                      className="text-center text-lg tracking-widest font-mono"
                    />
                  </div>
                  {volError && <p className="text-sm text-destructive">{volError}</p>}
                  <Button className="w-full" onClick={handleVolVerifyCode} disabled={volLoading || volCode.length !== 6}>
                    {volLoading ? "Verifying..." : "Verify"}
                  </Button>
                </div>
              )}

              {volStep === "profile" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vol-name">Your Name</Label>
                    <Input
                      id="vol-name"
                      placeholder="Your full name"
                      value={volName}
                      onChange={(e) => setVolName(e.target.value)}
                    />
                  </div>
                  {volError && <p className="text-sm text-destructive">{volError}</p>}
                  <Button className="w-full" onClick={handleVolCreateProfile} disabled={volLoading || !volName}>
                    {volLoading ? "Creating profile..." : "Complete Registration"}
                  </Button>
                </div>
              )}

              {volStep === "done" && (
                <div className="text-center space-y-3 py-4">
                  <div className="text-4xl">&#x2705;</div>
                  <p className="font-medium">Registration complete!</p>
                  <p className="text-sm text-muted-foreground">Redirecting to scanner...</p>
                </div>
              )}
            </div>
          </div>

          {/* ---- Admin Panel ---- */}
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="bg-[var(--color-primary)] px-5 py-4">
              <h2 className="font-display text-lg text-[var(--color-text-on-primary)]">
                Admin
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#B4A689" }}>
                Email &amp; password
              </p>
            </div>
            <div className="bg-card p-5">
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@umd.edu"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                </div>
                {adminError && <p className="text-sm text-destructive">{adminError}</p>}
                <Button type="submit" className="w-full" disabled={adminLoading}>
                  {adminLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-[var(--color-primary)] transition-colors underline underline-offset-2"
          >
            &larr; Back to attendee login
          </a>
        </div>
      </div>
    </main>
  );
}
