"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StationData {
  id: string;
  name: string;
  type: string;
  foodItem: string | null;
  isActive: boolean;
  visitCount: number;
  volunteerCount: number;
  inventoryPercent: number | null;
}

interface StationGridProps {
  stations: StationData[];
  loading?: boolean;
}

function getInventoryColor(percent: number | null): string {
  if (percent === null) return "bg-gray-200";
  if (percent > 50) return "bg-green-500";
  if (percent > 25) return "bg-yellow-500";
  if (percent > 10) return "bg-orange-500";
  if (percent > 0) return "bg-red-500";
  return "bg-gray-900";
}

export function StationGrid({ stations, loading }: StationGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 16 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <div className="h-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stations.map((station) => (
        <Card
          key={station.id}
          className={cn(!station.isActive && "opacity-50")}
        >
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold leading-tight">
                {station.name}
              </h3>
              {!station.isActive && (
                <Badge variant="secondary" className="text-[10px] px-1">
                  OFF
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{station.visitCount} visits</span>
              <span>{station.volunteerCount} vol.</span>
            </div>

            {/* Inventory bar */}
            {station.inventoryPercent !== null && (
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    getInventoryColor(station.inventoryPercent)
                  )}
                  style={{ width: `${Math.max(station.inventoryPercent, 2)}%` }}
                />
              </div>
            )}

            {station.foodItem && (
              <p className="text-[10px] text-muted-foreground truncate">
                {station.foodItem}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
