"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, Utensils, MapPin } from "lucide-react";

interface Stats {
  totalRegistered: number;
  totalCheckedIn: number;
  totalRedemptions: number;
  activeVolunteers: number;
  totalStations: number;
  avgCompletionRate: number;
}

interface KPICardsProps {
  stats: Stats | null;
  loading?: boolean;
}

const kpis = [
  {
    key: "checkedIn" as const,
    label: "Checked In",
    icon: UserCheck,
    getValue: (s: Stats) => `${s.totalCheckedIn} / ${s.totalRegistered}`,
    getSubtext: (s: Stats) =>
      s.totalRegistered > 0
        ? `${Math.round((s.totalCheckedIn / s.totalRegistered) * 100)}%`
        : "0%",
  },
  {
    key: "redemptions" as const,
    label: "Redemptions",
    icon: Utensils,
    getValue: (s: Stats) => s.totalRedemptions.toString(),
    getSubtext: () => "total",
  },
  {
    key: "volunteers" as const,
    label: "Active Volunteers",
    icon: Users,
    getValue: (s: Stats) => s.activeVolunteers.toString(),
    getSubtext: () => "on duty",
  },
  {
    key: "completion" as const,
    label: "Avg. Completion",
    icon: MapPin,
    getValue: (s: Stats) => `${s.avgCompletionRate}%`,
    getSubtext: () => "stamps / 16",
  },
];

export function KPICards({ stats, loading }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.key}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </span>
            </div>
            {loading || !stats ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold">{kpi.getValue(stats)}</p>
                <p className="text-xs text-muted-foreground">
                  {kpi.getSubtext(stats)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
