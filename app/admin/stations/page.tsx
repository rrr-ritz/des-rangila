"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RefreshCw, X } from "lucide-react";
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

interface InventoryItem {
  id: string;
  stationId: string;
  itemName: string;
  initialCount: number;
  remainingCount: number;
}

function itemLabel(station: StationWithCounts): string {
  if (station.type === "food" && station.foodItem) return station.foodItem;
  if (station.type === "activity" && station.activityName) return station.activityName;
  return "\u2014";
}

function itemEmoji(station: StationWithCounts): string {
  if (station.type === "food") return "\uD83C\uDF7D";
  if (station.type === "activity") return "\uD83C\uDFA8";
  return "";
}

const STAMPABLE_TYPES = new Set(["food", "activity"]);

export default function StationsPage() {
  const { user } = useAuth();
  const [stations, setStations] = useState<StationWithCounts[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerData[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [stationsRes, volunteersRes, inventoryRes] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/volunteers", { headers }),
        fetch("/api/inventory", { headers }),
      ]);
      if (stationsRes.ok) {
        const data = await stationsRes.json();
        if (data.stations) setStations(data.stations);
      }
      if (volunteersRes.ok) {
        const data = await volunteersRes.json();
        setVolunteers(data.volunteers || []);
      }
      if (inventoryRes.ok) {
        const data = await inventoryRes.json();
        setInventory(data.items || []);
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

  const unassignVolunteer = async (volunteerId: string) => {
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
        body: JSON.stringify({ stationId: null }),
      });
      if (res.ok) {
        setVolunteers((prev) =>
          prev.map((v) =>
            v.id === volunteerId ? { ...v, currentStationId: null } : v
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setReassigning(null);
    }
  };

  function volunteersAtStation(stationId: string) {
    return volunteers.filter((v) => v.currentStationId === stationId);
  }

  function inventoryForStation(stationId: string): InventoryItem | undefined {
    return inventory.find((i) => i.stationId === stationId);
  }

  const stampableStations = stations.filter((s) => STAMPABLE_TYPES.has(s.type));
  const otherStations = stations.filter((s) => !STAMPABLE_TYPES.has(s.type));
  const activeCount = stations.filter((s) => s.isActive).length;
  const unassignedVolunteers = volunteers.filter((v) => !v.currentStationId);

  function renderStationRow(station: StationWithCounts) {
    const assigned = volunteersAtStation(station.id);
    const inv = inventoryForStation(station.id);
    const isStampable = STAMPABLE_TYPES.has(station.type);

    return (
      <TableRow key={station.id} className={!station.isActive ? "opacity-50" : ""}>
        <TableCell className="font-mono text-xs py-2">
          {station.tableNumber}
        </TableCell>
        <TableCell className="py-2">
          <span className="font-medium text-sm">{station.name}</span>
        </TableCell>
        <TableCell className="py-2">
          {isStampable ? (
            <span className="text-sm">
              {itemEmoji(station)} {itemLabel(station)}
              {inv && (
                <span className={`ml-1.5 text-xs font-mono ${
                  inv.remainingCount === 0
                    ? "text-red-600 font-bold"
                    : inv.remainingCount <= inv.initialCount * 0.2
                    ? "text-amber-600 font-semibold"
                    : "text-muted-foreground"
                }`}>
                  {inv.remainingCount}/{inv.initialCount}
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{"\u2014"}</span>
          )}
        </TableCell>
        <TableCell className="py-2">
          {assigned.length === 0 ? (
            <span className="text-amber-600 text-xs">None</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {assigned.map((v) => (
                <span key={v.id} className="inline-flex items-center gap-0.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {v.name}
                  <button
                    onClick={() => unassignVolunteer(v.id)}
                    disabled={reassigning !== null}
                    className="text-muted-foreground hover:text-destructive ml-0.5"
                    title={`Unassign ${v.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </TableCell>
        <TableCell className="py-2">
          <Select
            onValueChange={(volId) => reassignVolunteer(volId, station.id)}
            disabled={reassigning !== null}
          >
            <SelectTrigger className="h-7 w-[120px] text-xs">
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
        <TableCell className="text-center py-2">
          <Switch
            checked={station.isActive}
            onCheckedChange={() => toggleStation(station.id)}
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stations</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} of {stations.length} active
            {unassignedVolunteers.length > 0 && (
              <span className="text-amber-600 ml-2">
                ({unassignedVolunteers.length} unassigned)
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stampable stations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cultural Stations ({stampableStations.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Volunteers</TableHead>
                  <TableHead>Assign</TableHead>
                  <TableHead className="text-center w-16">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stampableStations.map(renderStationRow)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Non-stampable stations */}
      {otherStations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground">Other Stations</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {!loading && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Volunteers</TableHead>
                    <TableHead>Assign</TableHead>
                    <TableHead className="text-center w-16">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherStations.map(renderStationRow)}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
