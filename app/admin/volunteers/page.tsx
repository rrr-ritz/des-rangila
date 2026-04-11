"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
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
import { RefreshCw, Users, UserCheck, UserX, Ban, RotateCcw, Loader2 } from "lucide-react";

interface VolunteerData {
  id: string;
  name: string;
  phone: string;
  role: string;
  currentStationId: string | null;
  isActive: boolean;
  createdAt: { _seconds?: number; seconds?: number };
}

const STATION_NAMES: Record<string, string> = {
  "registration": "Check-In",
  "seven-sisters-sikkim": "Seven Sisters + Sikkim",
  "punjab": "Punjab",
  "west-bengal": "West Bengal",
  "maharashtra": "Maharashtra",
  "haryana-rajasthan": "Haryana + Rajasthan",
  "himachal-uttarakhand": "Himachal + Uttarakhand",
  "gujarat": "Gujarat",
  "jammu-kashmir": "Jammu & Kashmir + Ladakh",
  "motion-cafe": "Motion Cafe",
  "central-india": "Central India",
  "kerala": "Kerala",
  "andhra-telangana": "AP + Telangana",
  "karnataka": "Karnataka",
  "odisha": "Odisha",
  "tamil-nadu": "Tamil Nadu",
  "photo-booth": "Photo Booth",
};

function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  // Strip leading 1 (country code) if 11 digits
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return e164;
}

export default function VolunteersPage() {
  const { user } = useAuth();
  const [volunteers, setVolunteers] = useState<VolunteerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchVolunteers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/volunteers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVolunteers(data.volunteers || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  const toggleVolunteer = async (vol: VolunteerData) => {
    if (!user) return;
    setTogglingId(vol.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/volunteers/${vol.id}/deactivate`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !vol.isActive }),
      });
      if (res.ok) {
        setVolunteers((prev) =>
          prev.map((v) =>
            v.id === vol.id ? { ...v, isActive: !v.isActive } : v
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setTogglingId(null);
    }
  };

  const totalVolunteers = volunteers.length;
  const activeVolunteers = volunteers.filter((v) => v.isActive).length;
  const assignedVolunteers = volunteers.filter((v) => v.currentStationId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Volunteers</h1>
          <p className="text-sm text-muted-foreground">
            Manage volunteer assignments and status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchVolunteers}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{totalVolunteers}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{activeVolunteers}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserX className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{assignedVolunteers}</p>
              <p className="text-xs text-muted-foreground">At a Station</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Volunteers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : volunteers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No volunteers registered yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteers.map((vol) => {
                  const joinedDate = vol.createdAt
                    ? new Date(
                        ((vol.createdAt._seconds || vol.createdAt.seconds || 0) * 1000)
                      ).toLocaleDateString()
                    : "—";
                  return (
                    <TableRow
                      key={vol.id}
                      className={`${!vol.currentStationId ? "bg-amber-50" : ""} ${!vol.isActive ? "opacity-50" : ""}`}
                    >
                      <TableCell className="font-medium">{vol.name}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {formatPhone(vol.phone)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={vol.role === "admin" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {vol.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {vol.currentStationId
                          ? STATION_NAMES[vol.currentStationId] || vol.currentStationId
                          : <span className="text-amber-600 font-medium">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={vol.isActive ? "default" : "outline"}
                          className="text-xs"
                        >
                          {vol.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {joinedDate}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors ${vol.isActive ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}`}
                          disabled={togglingId === vol.id}
                          onClick={() => toggleVolunteer(vol)}
                          title={vol.isActive ? "Deactivate" : "Reactivate"}
                        >
                          {togglingId === vol.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : vol.isActive ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </button>
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
