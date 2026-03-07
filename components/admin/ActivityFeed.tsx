"use client";

import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  action: string;
  actorName: string;
  details: Record<string, unknown>;
  severity: "info" | "warning" | "error";
  timestamp: { _seconds?: number; seconds?: number };
}

interface ActivityFeedProps {
  entries: ActivityItem[];
  loading?: boolean;
}

function formatAction(entry: ActivityItem): string {
  switch (entry.action) {
    case "redemption.created":
      return `${entry.actorName} redeemed ${entry.details.itemType || "item"} for ${entry.details.attendeeName || "attendee"} at ${entry.details.stationId || "station"}`;
    case "attendee.checked_in":
      return `${entry.actorName} checked in ${(entry.details.attendeeName as string) || "attendee"}`;
    case "volunteer.station_changed":
      return `${entry.actorName} moved to ${(entry.details.newStation as string) || "station"}`;
    case "inventory.low_stock":
      return `Low stock: ${(entry.details.itemName as string) || "item"} (${entry.details.remaining} left)`;
    case "inventory.depleted":
      return `SOLD OUT: ${(entry.details.itemName as string) || "item"}`;
    case "admin.import_attendees":
      return `Imported ${entry.details.imported} attendees`;
    default:
      return `${entry.actorName}: ${entry.action}`;
  }
}

function formatTime(ts: { _seconds?: number; seconds?: number }): string {
  const secs = ts._seconds || ts.seconds;
  if (!secs) return "";
  const date = new Date(secs * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const severityDot: Record<string, string> = {
  info: "bg-blue-400",
  warning: "bg-amber-400",
  error: "bg-red-500",
};

export function ActivityFeed({ entries, loading }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No activity yet.
      </p>
    );
  }

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-2 px-3 py-2 rounded-md hover:bg-muted/50 text-sm"
        >
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
              severityDot[entry.severity] || severityDot.info
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">{formatAction(entry)}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatTime(entry.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
