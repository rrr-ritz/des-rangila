"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  message: string;
  severity: "info" | "warning" | "error";
  timestamp: string;
  read: boolean;
}

interface NotificationBellProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationBell({
  notifications,
  onDismiss,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <span className="text-xs text-muted-foreground">
                {unread} unread
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-2 p-3 border-b last:border-0 text-sm",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        n.severity === "error"
                          ? "bg-red-500"
                          : n.severity === "warning"
                            ? "bg-amber-400"
                            : "bg-blue-400"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {n.timestamp}
                      </p>
                    </div>
                    <button
                      onClick={() => onDismiss(n.id)}
                      className="shrink-0 p-0.5 hover:bg-muted rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
