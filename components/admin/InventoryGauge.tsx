"use client";

import { cn } from "@/lib/utils";

interface InventoryItemData {
  id: string;
  stationId: string;
  itemName: string;
  initialCount: number;
  remainingCount: number;
  unit: string;
}

interface InventoryGaugeProps {
  items: InventoryItemData[];
  loading?: boolean;
}

function getColor(percent: number): string {
  if (percent > 50) return "bg-green-500";
  if (percent > 25) return "bg-yellow-500";
  if (percent > 10) return "bg-orange-500";
  if (percent > 0) return "bg-red-500";
  return "bg-gray-900";
}

function getTextColor(percent: number): string {
  if (percent > 50) return "text-green-700";
  if (percent > 25) return "text-yellow-700";
  if (percent > 10) return "text-orange-700";
  if (percent > 0) return "text-red-700";
  return "text-gray-900";
}

export function InventoryGauge({ items, loading }: InventoryGaugeProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No inventory items configured.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percent =
          item.initialCount > 0
            ? Math.round((item.remainingCount / item.initialCount) * 100)
            : 0;
        return (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{item.itemName}</span>
              <span
                className={cn("text-xs font-medium", getTextColor(percent))}
              >
                {item.remainingCount} / {item.initialCount} {item.unit}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={cn(
                  "h-2 rounded-full transition-all duration-500",
                  getColor(percent)
                )}
                style={{ width: `${Math.max(percent, 1)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
