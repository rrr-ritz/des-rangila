"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// All 16 stations from the design doc
const STATIONS = [
  { id: "jammu-kashmir", name: "Jammu & Kashmir", region: "North" },
  { id: "punjab", name: "Punjab", region: "North" },
  { id: "rajasthan", name: "Rajasthan", region: "West" },
  { id: "gujarat", name: "Gujarat", region: "West" },
  { id: "maharashtra", name: "Maharashtra", region: "West" },
  { id: "goa", name: "Goa", region: "West" },
  { id: "karnataka", name: "Karnataka", region: "South" },
  { id: "kerala", name: "Kerala", region: "South" },
  { id: "tamil-nadu", name: "Tamil Nadu", region: "South" },
  { id: "andhra-pradesh", name: "Andhra Pradesh", region: "South" },
  { id: "telangana", name: "Telangana", region: "South" },
  { id: "odisha", name: "Odisha", region: "East" },
  { id: "west-bengal", name: "West Bengal", region: "East" },
  { id: "northeast", name: "Northeast India", region: "East" },
  { id: "uttar-pradesh", name: "Uttar Pradesh", region: "North" },
  { id: "madhya-pradesh", name: "Madhya Pradesh", region: "Central" },
];

interface StampPassportProps {
  stampsCollected: string[];
}

export function StampPassport({ stampsCollected }: StampPassportProps) {
  const visited = new Set(stampsCollected);
  const count = visited.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Stamp Passport</h2>
        <span className="text-sm font-medium text-muted-foreground">
          {count}/16 stations visited
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${(count / 16) * 100}%` }}
        />
      </div>

      {/* Station grid */}
      <div className="grid grid-cols-4 gap-2">
        {STATIONS.map((station) => {
          const isVisited = visited.has(station.id);
          return (
            <div
              key={station.id}
              className={cn(
                "aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-1 text-center transition-all",
                isVisited
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/30 opacity-50"
              )}
            >
              {isVisited && (
                <Check className="h-4 w-4 text-primary mb-0.5" />
              )}
              <span
                className={cn(
                  "text-[10px] leading-tight font-medium",
                  isVisited ? "text-primary" : "text-muted-foreground"
                )}
              >
                {station.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
