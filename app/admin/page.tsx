"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICards } from "@/components/admin/KPICards";
import { StationGrid } from "@/components/admin/StationGrid";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useAuth } from "@/components/providers/AuthProvider";

interface Stats {
  totalRegistered: number;
  totalCheckedIn: number;
  totalRedemptions: number;
  activeVolunteers: number;
  totalStations: number;
  avgCompletionRate: number;
}

interface StationData {
  id: string;
  name: string;
  type: string;
  foodItem: string | null;
  isActive: boolean;
  visitCount: number;
  volunteerCount: number;
  inventoryPercent: number | null;
}

interface ActivityItem {
  id: string;
  action: string;
  actorName: string;
  details: Record<string, unknown>;
  severity: "info" | "warning" | "error";
  timestamp: { _seconds?: number; seconds?: number };
}

interface Notification {
  id: string;
  message: string;
  severity: "info" | "warning" | "error";
  timestamp: string;
  read: boolean;
}

const SESSION_KEY = "des-rangila-admin-visited";

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [stations, setStations] = useState<StationData[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  // On first visit in this session, redirect to check-in
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setRedirecting(true);
        router.replace("/admin/check-in");
      }
    } catch {
      // sessionStorage not available
    }
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, activityRes] = await Promise.allSettled([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/admin/audit-log?limit=30", { headers }),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data);
        if (data.stations) {
          setStations(data.stations);
        }
      }

      if (activityRes.status === "fulfilled" && activityRes.value.ok) {
        const data = await activityRes.value.json();
        const entries = data.entries || [];
        setActivity(entries);

        const notifs: Notification[] = entries
          .filter((e: ActivityItem) => e.severity !== "info" && (e.action === "inventory.low_stock" || e.action === "inventory.depleted" || e.action === "system.error"))
          .slice(0, 10)
          .map((e: ActivityItem) => ({
            id: e.id,
            message: e.action === "inventory.low_stock"
              ? `Low stock: ${(e.details.itemName as string) || "item"}`
              : e.action === "inventory.depleted"
                ? `SOLD OUT: ${(e.details.itemName as string) || "item"}`
                : `Error: ${e.action}`,
            severity: e.severity,
            timestamp: new Date(
              ((e.timestamp._seconds || e.timestamp.seconds || 0) * 1000)
            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            read: false,
          }));
        setNotifications(notifs);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!redirecting) {
      fetchData();
      const interval = setInterval(fetchData, 30_000);
      return () => clearInterval(interval);
    }
  }, [fetchData, redirecting]);

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  if (redirecting) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Event Overview</h1>
          <p className="text-sm text-muted-foreground">
            Real-time dashboard for Des Rangila
          </p>
        </div>
        <NotificationBell
          notifications={notifications}
          onDismiss={handleDismissNotification}
        />
      </div>

      <KPICards stats={stats} loading={loading} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Station Grid</CardTitle>
            </CardHeader>
            <CardContent>
              <StationGrid stations={stations} loading={loading} />
              {!loading && stations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Station data will appear here once stations are configured and the event begins.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed entries={activity} loading={loading} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
