import { cn } from "@/lib/utils";

interface EventHeaderProps {
  className?: string;
}

export function EventHeader({ className }: EventHeaderProps) {
  return (
    <div className={cn("text-center", className)}>
      <h1 className="text-3xl font-bold tracking-tight font-display text-[var(--color-primary)]">
        Des Rangila
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Tour of India &middot; April 11, 2026 &middot; 5&ndash;8 PM
      </p>
      <p className="text-xs text-muted-foreground">
        McKeldin Mall, University of Maryland
      </p>
    </div>
  );
}
