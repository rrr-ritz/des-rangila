"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Search } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  targetId: string | null;
  details: Record<string, unknown>;
  severity: string;
  timestamp: { _seconds?: number; seconds?: number };
}

const severityColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warning: "outline",
  error: "destructive",
};

const actionLabels: Record<string, string> = {
  "redemption.created": "Redemption",
  "attendee.checked_in": "Check-in",
  "volunteer.station_changed": "Station Change",
  "inventory.low_stock": "Low Stock",
  "inventory.depleted": "Depleted",
  "photo.uploaded": "Photo Upload",
  "admin.import_attendees": "CSV Import",
  "system.error": "System Error",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const fetchAuditLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterAction !== "all") params.set("action", filterAction);
      if (filterSeverity !== "all") params.set("severity", filterSeverity);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterSeverity]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const filteredEntries = entries.filter((entry) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      entry.actorName.toLowerCase().includes(term) ||
      entry.action.toLowerCase().includes(term) ||
      JSON.stringify(entry.details).toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Complete event activity history
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAuditLog}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by actor, action, details..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="redemption.created">Redemptions</SelectItem>
                <SelectItem value="attendee.checked_in">Check-ins</SelectItem>
                <SelectItem value="volunteer.station_changed">Station Changes</SelectItem>
                <SelectItem value="inventory.low_stock">Low Stock</SelectItem>
                <SelectItem value="inventory.depleted">Depleted</SelectItem>
                <SelectItem value="admin.import_attendees">Imports</SelectItem>
                <SelectItem value="system.error">Errors</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Log entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filteredEntries.length} entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No audit log entries found. Events will appear here as the system is used.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-center">Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const ts = entry.timestamp._seconds || entry.timestamp.seconds;
                    const time = ts
                      ? new Date(ts * 1000).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "—";

                    const detailStr = Object.entries(entry.details)
                      .filter(([k]) => k !== "timestamp")
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ");

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {time}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={severityColors[entry.severity] || "secondary"}
                            className="text-xs"
                          >
                            {actionLabels[entry.action] || entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{entry.actorName}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.actorRole}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                          {detailStr || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div
                            className={`w-2 h-2 rounded-full mx-auto ${
                              entry.severity === "error"
                                ? "bg-red-500"
                                : entry.severity === "warning"
                                  ? "bg-amber-400"
                                  : "bg-blue-400"
                            }`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
