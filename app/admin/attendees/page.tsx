"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Search, CheckCircle, XCircle, Send, Loader2, CheckCheck, Ban, RotateCcw } from "lucide-react";

interface AttendeeRow {
  id: string;
  name: string;
  email: string;
  pin: string;
  checkedIn: boolean;
  stampsCollected: string[];
  totalFoodRedemptions: number;
  maxFoodRedemptions: number;
  passEmailSentAt?: string;
  deactivated?: boolean;
}

export default function AttendeesPage() {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAttendees = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/attendees?search=${encodeURIComponent(search)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setAttendees(data.attendees || []);
    } catch {
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  }, [user, search]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  const sendPass = async (attendee: AttendeeRow) => {
    if (!user) return;
    setSendingId(attendee.id);
    setSendError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/passes/send/${attendee.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || "Failed to send");
        return;
      }
      setAttendees((prev) =>
        prev.map((a) =>
          a.id === attendee.id
            ? { ...a, passEmailSentAt: new Date().toISOString() }
            : a
        )
      );
    } catch {
      setSendError("Network error");
    } finally {
      setSendingId(null);
    }
  };

  const toggleDeactivate = async (attendee: AttendeeRow) => {
    if (!user) return;
    setTogglingId(attendee.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/attendees/${attendee.id}/deactivate`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deactivated: !attendee.deactivated }),
      });
      if (res.ok) {
        setAttendees((prev) =>
          prev.map((a) =>
            a.id === attendee.id
              ? { ...a, deactivated: !a.deactivated }
              : a
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendees</h1>
      </div>

      {sendError && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-md">
          {sendError}
        </div>
      )}

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or PIN..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : attendees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No attendees found.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">PIN</th>
                    <th className="text-center p-3 font-medium">Checked In</th>
                    <th className="text-center p-3 font-medium">Stamps</th>
                    <th className="text-center p-3 font-medium">Food</th>
                    <th className="text-center p-3 font-medium">Pass</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b last:border-0 ${a.deactivated ? "opacity-50" : ""}`}
                    >
                      <td className="p-3 font-medium">
                        {a.name}
                        {a.deactivated && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            Deactivated
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{a.email}</td>
                      <td className="p-3 font-mono">{a.pin}</td>
                      <td className="p-3 text-center">
                        {a.checkedIn ? (
                          <CheckCircle className="h-4 w-4 text-success mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {a.stampsCollected?.length || 0}/15
                      </td>
                      <td className="p-3 text-center">
                        {a.totalFoodRedemptions}/{a.maxFoodRedemptions}
                      </td>
                      <td className="p-3 text-center">
                        {a.passEmailSentAt ? (
                          <CheckCheck className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            disabled={sendingId === a.id || !!a.deactivated}
                            onClick={() => sendPass(a)}
                          >
                            {sendingId === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 px-2 ${a.deactivated ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700"}`}
                          disabled={togglingId === a.id}
                          onClick={() => toggleDeactivate(a)}
                          title={a.deactivated ? "Reactivate" : "Deactivate"}
                        >
                          {togglingId === a.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : a.deactivated ? (
                            <RotateCcw className="h-3.5 w-3.5" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
