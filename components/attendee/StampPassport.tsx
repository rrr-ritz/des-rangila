"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// Stampable stations (excludes registration & photo booth)
const STATIONS = [
  { id: "jammu-kashmir", name: "J&K + Ladakh" },
  { id: "himachal-uttarakhand", name: "Himachal + Uttarakhand" },
  { id: "punjab", name: "Punjab" },
  { id: "haryana-rajasthan", name: "Haryana + Rajasthan" },
  { id: "gujarat", name: "Gujarat" },
  { id: "maharashtra", name: "Maharashtra" },
  { id: "central-india", name: "Central India" },
  { id: "odisha", name: "Odisha" },
  { id: "west-bengal", name: "West Bengal" },
  { id: "seven-sisters-sikkim", name: "Seven Sisters + Sikkim" },
  { id: "andhra-telangana", name: "AP + Telangana" },
  { id: "karnataka", name: "Karnataka" },
  { id: "tamil-nadu", name: "Tamil Nadu" },
  { id: "kerala", name: "Kerala" },
  { id: "motion-cafe", name: "Motion Cafe" },
];

const TOTAL = STATIONS.length;

interface StampPassportProps {
  stampsCollected: string[];
}

export function StampPassport({ stampsCollected }: StampPassportProps) {
  const visited = new Set(stampsCollected);
  const count = STATIONS.filter((s) => visited.has(s.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Stamp Passport</h2>
        <span className="text-sm font-medium text-muted-foreground">
          {count}/{TOTAL} stations visited
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${(count / TOTAL) * 100}%` }}
        />
      </div>

      {/* Station grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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
