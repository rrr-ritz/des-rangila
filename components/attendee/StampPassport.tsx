"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STATIONS = [
  { id: "jammu-kashmir", name: "J&K" },
  { id: "himachal-uttarakhand", name: "HP + UK" },
  { id: "punjab", name: "Punjab" },
  { id: "haryana-rajasthan", name: "HR + Raj" },
  { id: "gujarat", name: "Gujarat" },
  { id: "maharashtra", name: "Maharashtra" },
  { id: "central-india", name: "Central" },
  { id: "odisha", name: "Odisha" },
  { id: "west-bengal", name: "Bengal" },
  { id: "seven-sisters-sikkim", name: "7 Sisters" },
  { id: "andhra-telangana", name: "AP + TS" },
  { id: "karnataka", name: "Karnataka" },
  { id: "tamil-nadu", name: "TN" },
  { id: "kerala", name: "Kerala" },
  { id: "motion-cafe", name: "Motion" },
];

const TOTAL = STATIONS.length;

// Deterministic rotation per station for the "hand-stamped" feel
const ROTATIONS = [-2, 1, -1, 2, -3, 1, -2, 3, -1, 2, -2, 1, 3, -1, 2];

interface StampPassportProps {
  stampsCollected: string[];
}

export function StampPassport({ stampsCollected }: StampPassportProps) {
  const visited = new Set(stampsCollected);
  const count = STATIONS.filter((s) => visited.has(s.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Stamp passport</h2>
        <span className="text-sm text-muted-foreground">
          {count}/{TOTAL} visited
        </span>
      </div>

      {/* Progress bar — saffron fill */}
      <div className="w-full bg-border rounded-full h-1.5">
        <div
          className="bg-accent h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(count / TOTAL) * 100}%` }}
        />
      </div>

      {/* Station grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {STATIONS.map((station, i) => {
          const isVisited = visited.has(station.id);
          return (
            <div
              key={station.id}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center p-1.5 text-center overflow-hidden transition-all",
                isVisited
                  ? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-2 border-[var(--color-primary)]"
                  : "bg-transparent text-muted-foreground border-2 border-dashed border-border"
              )}
              style={isVisited ? { transform: `rotate(${ROTATIONS[i]}deg)` } : undefined}
            >
              {isVisited && (
                <Check className="h-3.5 w-3.5 mb-0.5" style={{ color: 'var(--color-text-on-primary)' }} />
              )}
              <span className="text-[10px] leading-tight font-medium">
                {station.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
