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
import { RefreshCw, Users, UserCheck, UserX } from "lucide-react";

interface VolunteerData {
  id: string;
  name: string;
  phone: string;
  role: string;
  currentStationId: string | null;
  isActive: boolean;
  createdAt: { _seconds?: number; seconds?: number };
}

export default function VolunteersPage() {
  const { user } = useAuth();
  const [volunteers, setVolunteers] = useState<VolunteerData[]>([]);
  const [loading, setLoading] = useState(true);

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

      {/* Summary cards */}
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

      {/* Volunteers table */}
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
              No volunteers registered yet. Volunteers can register at /volunteer/register.
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
                    <TableRow key={vol.id}>
                      <TableCell className="font-medium">{vol.name}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {vol.phone}
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
                        {vol.currentStationId || "Unassigned"}
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
