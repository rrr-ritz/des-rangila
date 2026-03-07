"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 space-y-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
