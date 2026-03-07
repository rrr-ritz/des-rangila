"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, MapPin, Utensils, Camera, UserPlus } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Station } from "@/lib/types";

type StationWithCounts = Station & {
  visitCount?: number;
  volunteerCount?: number;
};

const typeIcons: Record<string, React.ReactNode> = {
  activity: <MapPin className="h-3.5 w-3.5" />,
  food: <Utensils className="h-3.5 w-3.5" />,
  both: <><MapPin className="h-3.5 w-3.5" /><Utensils className="h-3.5 w-3.5" /></>,
  "photo-booth": <Camera className="h-3.5 w-3.5" />,
  registration: <UserPlus className="h-3.5 w-3.5" />,
};

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  activity: "default",
  food: "secondary",
  both: "default",
  "photo-booth": "outline",
  registration: "outline",
};

export default function StationsPage() {
  const { user } = useAuth();
  const [stations, setStations] = useState<StationWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stations) {
          setStations(data.stations);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const toggleStation = (id: string) => {
    setStations((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const activeCount = stations.filter((s) => s.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stations</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} of {stations.length} stations active
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStations}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Stations</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Food</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((station) => (
                  <TableRow key={station.id} className={!station.isActive ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-xs">
                      {station.tableNumber}
                    </TableCell>
                    <TableCell className="font-medium">{station.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {station.region || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant[station.type] || "outline"} className="gap-1 text-xs">
                        {typeIcons[station.type]}
                        {station.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {station.activityName || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {station.foodItem || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={station.isActive}
                        onCheckedChange={() => toggleStation(station.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
