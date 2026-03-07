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
  const [stations, setStations] = useState<StationWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStations = useCallback(async () => {
    setLoading(true);
    try {
      // Stations don't have a dedicated list endpoint yet —
      // in production this would be fetched from Firestore.
      // For now, use hardcoded station data matching the design doc.
      const defaultStations: StationWithCounts[] = [
        { id: "s1", name: "Punjab", region: "North India", type: "both" as const, activityName: "Bhangra Workshop", foodItem: "Chole Bhature", tableNumber: 1, order: 1, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s2", name: "Rajasthan", region: "North India", type: "both" as const, activityName: "Puppet Making", foodItem: "Dal Baati", tableNumber: 2, order: 2, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s3", name: "Gujarat", region: "West India", type: "both" as const, activityName: "Garba Dance", foodItem: "Dhokla", tableNumber: 3, order: 3, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s4", name: "Maharashtra", region: "West India", type: "both" as const, activityName: "Warli Art", foodItem: "Vada Pav", tableNumber: 4, order: 4, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s5", name: "Tamil Nadu", region: "South India", type: "both" as const, activityName: "Kolam Design", foodItem: "Dosa & Chutney", tableNumber: 5, order: 5, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s6", name: "Kerala", region: "South India", type: "both" as const, activityName: "Kathakali Mask", foodItem: "Banana Chips", tableNumber: 6, order: 6, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s7", name: "Karnataka", region: "South India", type: "both" as const, activityName: "Mysore Art", foodItem: "Bisi Bele Bath", tableNumber: 7, order: 7, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s8", name: "West Bengal", region: "East India", type: "both" as const, activityName: "Alpona Art", foodItem: "Rasgulla", tableNumber: 8, order: 8, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s9", name: "Assam", region: "Northeast India", type: "both" as const, activityName: "Tea Tasting", foodItem: "Pitha", tableNumber: 9, order: 9, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s10", name: "Odisha", region: "East India", type: "both" as const, activityName: "Pattachitra", foodItem: "Chhena Poda", tableNumber: 10, order: 10, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s11", name: "Madhya Pradesh", region: "Central India", type: "both" as const, activityName: "Gond Art", foodItem: "Poha Jalebi", tableNumber: 11, order: 11, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s12", name: "Uttar Pradesh", region: "North India", type: "both" as const, activityName: "Chikankari Demo", foodItem: "Chaat", tableNumber: 12, order: 12, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s13", name: "Goa", region: "West India", type: "both" as const, activityName: "Tile Painting", foodItem: "Bebinca", tableNumber: 13, order: 13, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s14", name: "Himachal Pradesh", region: "North India", type: "both" as const, activityName: "Kullu Shawl Weaving", foodItem: "Siddu", tableNumber: 14, order: 14, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s15", name: "Photo Booth", region: "", type: "photo-booth" as const, activityName: "Photo Strip", foodItem: null, tableNumber: 15, order: 15, isActive: true, visitCount: 0, volunteerCount: 0 },
        { id: "s16", name: "Registration", region: "", type: "registration" as const, activityName: "Check-in", foodItem: null, tableNumber: 16, order: 16, isActive: true, visitCount: 0, volunteerCount: 0 },
      ];
      setStations(defaultStations);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

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
