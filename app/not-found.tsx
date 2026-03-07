import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 space-y-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
        <Button asChild>
          <Link href="/me">My Passport</Link>
        </Button>
      </div>
    </div>
  );
}
