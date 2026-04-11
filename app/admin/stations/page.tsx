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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, MapPin, Utensils, Camera, UserPlus } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Station } from "@/lib/types";

type StationWithCounts = Station & {
  visitCount?: number;
  volunteerCount?: number;
};

interface VolunteerData {
  id: string;
  name: string;
  currentStationId: string | null;
}

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
  const [volunteers, setVolunteers] = useState<VolunteerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [stationsRes, volunteersRes] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/volunteers", { headers }),
      ]);
      if (stationsRes.ok) {
        const data = await stationsRes.json();
        if (data.stations) setStations(data.stations);
      }
      if (volunteersRes.ok) {
        const data = await volunteersRes.json();
        setVolunteers(data.volunteers || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleStation = (id: string) => {
    setStations((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const reassignVolunteer = async (volunteerId: string, newStationId: string) => {
    if (!user) return;
    setReassigning(volunteerId);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/volunteers/${volunteerId}/station`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stationId: newStationId }),
      });
      if (res.ok) {
        setVolunteers((prev) =>
          prev.map((v) =>
            v.id === volunteerId ? { ...v, currentStationId: newStationId } : v
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setReassigning(null);
    }
  };

  const activeCount = stations.filter((s) => s.isActive).length;

  function volunteersAtStation(stationId: string) {
    return volunteers.filter((v) => v.currentStationId === stationId);
  }

  // Volunteers not assigned to any station
  const unassignedVolunteers = volunteers.filter((v) => !v.currentStationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stations</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} of {stations.length} stations active
            {unassignedVolunteers.length > 0 && (
              <span className="text-amber-600 ml-2">
                ({unassignedVolunteers.length} unassigned volunteer{unassignedVolunteers.length !== 1 ? "s" : ""})
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Food</TableHead>
                  <TableHead>Volunteers</TableHead>
                  <TableHead>Assign</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((station) => {
                  const assigned = volunteersAtStation(station.id);
                  return (
                    <TableRow key={station.id} className={!station.isActive ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">
                        {station.tableNumber}
                      </TableCell>
                      <TableCell className="font-medium">{station.name}</TableCell>
                      <TableCell>
                        <Badge variant={typeBadgeVariant[station.type] || "outline"} className="gap-1 text-xs">
                          {typeIcons[station.type]}
                          {station.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {station.foodItem || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {assigned.length === 0 ? (
                          <span className="text-amber-600 text-xs">None</span>
                        ) : (
                          <div className="space-y-0.5">
                            {assigned.map((v) => (
                              <div key={v.id} className="text-xs">{v.name}</div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          onValueChange={(volId) => reassignVolunteer(volId, station.id)}
                          disabled={reassigning !== null}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="+ Assign" />
                          </SelectTrigger>
                          <SelectContent>
                            {volunteers
                              .filter((v) => v.currentStationId !== station.id)
                              .map((v) => (
                                <SelectItem key={v.id} value={v.id} className="text-xs">
                                  {v.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={station.isActive}
                          onCheckedChange={() => toggleStation(station.id)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
