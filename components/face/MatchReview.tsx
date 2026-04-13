"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, RefreshCw, Loader2, ShieldCheck, AlertTriangle, Ban } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface MatchItem {
  id: string;
  photoId: string;
  photoUrl: string;
  selfieUrl: string | null;
  attendeeId: string;
  attendeeName: string;
  confidence: number;
  faceBox?: { x: number; y: number; width: number; height: number };
  boundingBox?: { x: number; y: number; width: number; height: number };
  status: string;
  createdAt: { _seconds?: number; seconds?: number };
}

type StatusFilter = "pending" | "auto-approved" | "rejected" | "all";

interface MatchReviewProps {
  refreshTrigger: number;
  statusFilter?: StatusFilter;
  onStatsUpdate?: (stats: { autoApproved: number; pending: number; rejected: number; approved: number }) => void;
}

function confidenceColor(c: number): string {
  if (c >= 0.6) return "text-green-700 dark:text-green-400";
  if (c >= 0.45) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

function confidenceBg(c: number): string {
  if (c >= 0.6) return "bg-green-100 dark:bg-green-900/30";
  if (c >= 0.45) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function statusBadge(status: string) {
  switch (status) {
    case "auto-approved":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 text-[10px]">
          <ShieldCheck className="h-3 w-3 mr-0.5" />
          Auto
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
          <AlertTriangle className="h-3 w-3 mr-0.5" />
          Review
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 text-[10px]">
          <Check className="h-3 w-3 mr-0.5" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="secondary" className="text-muted-foreground text-[10px]">
          <Ban className="h-3 w-3 mr-0.5" />
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

export function MatchReview({ refreshTrigger, statusFilter = "pending", onStatsUpdate }: MatchReviewProps) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/photos/face-match/queue?status=${statusFilter}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        if (data.stats) {
          statsRef.current = data.stats;
          if (onStatsUpdate) onStatsUpdate(data.stats);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter, user, onStatsUpdate]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches, refreshTrigger]);

  // Local stats for optimistic updates
  const statsRef = useRef({ autoApproved: 0, pending: 0, rejected: 0, approved: 0 });

  const updateStatsAfterAction = useCallback((oldStatus: string, action: "approve" | "reject") => {
    const s = statsRef.current;
    if (oldStatus === "auto-approved") s.autoApproved = Math.max(0, s.autoApproved - 1);
    else if (oldStatus === "pending") s.pending = Math.max(0, s.pending - 1);
    if (action === "approve") s.approved++;
    else s.rejected++;
    if (onStatsUpdate) onStatsUpdate({ ...s });
  }, [onStatsUpdate]);

  const handleAction = async (matchId: string, action: "approve" | "reject") => {
    if (!user) return;
    const match = matches.find((m) => m.id === matchId);
    setActionLoading(matchId);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/photos/face-match/${matchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        // Remove card locally (preserves scroll position)
        setMatches((prev) => prev.filter((m) => m.id !== matchId));
        // Update stats optimistically
        if (match) updateStatsAfterAction(match.status, action);
      }
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (!user) return;
    const token = await user.getIdToken();
    const currentMatches = [...matches];
    for (const match of currentMatches) {
      setActionLoading(match.id);
      try {
        await fetch(`/api/photos/face-match/${match.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        });
        setMatches((prev) => prev.filter((m) => m.id !== match.id));
        updateStatsAfterAction(match.status, action);
      } catch {
        // continue to next
      }
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    const emptyMessages: Record<StatusFilter, string> = {
      pending: "No pending matches to review.",
      "auto-approved": "No auto-approved matches.",
      rejected: "No rejected matches.",
      all: "No matches found.",
    };

    return (
      <div className="text-center py-8 text-muted-foreground space-y-2">
        <p>{emptyMessages[statusFilter]}</p>
        <Button variant="outline" size="sm" onClick={fetchMatches}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  const showActions = statusFilter !== "rejected";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {matches.length} match{matches.length !== 1 ? "es" : ""}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMatches}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {statusFilter === "pending" && matches.length > 1 && (
            <>
              <Button size="sm" onClick={() => handleBulkAction("approve")}>
                <Check className="h-4 w-4 mr-2" />
                Approve All
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction("reject")}>
                <X className="h-4 w-4 mr-2" />
                Reject All
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {matches.map((match) => (
          <Card key={match.id} className="overflow-hidden">
            <CardContent className="p-3">
              {/* Header: name, confidence, status, actions */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-sm">{match.attendeeName}</p>
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold ${confidenceBg(match.confidence)} ${confidenceColor(match.confidence)}`}>
                    {match.confidence.toFixed(3)}
                  </div>
                  {statusBadge(match.status)}
                </div>
                {showActions && (match.status === "pending" || match.status === "auto-approved") && (
                  <div className="flex gap-1.5">
                    {match.status === "pending" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAction(match.id, "approve")}
                        disabled={actionLoading === match.id}
                      >
                        {actionLoading === match.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        Approve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={match.status === "auto-approved" ? "destructive" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => handleAction(match.id, "reject")}
                      disabled={actionLoading === match.id}
                    >
                      {actionLoading === match.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <X className="h-3 w-3 mr-1" />
                      )}
                      {match.status === "auto-approved" ? "Revoke" : "Reject"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Side-by-side photos — full width, natural aspect ratio */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Photo</p>
                  <div className="rounded-lg overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={match.photoUrl}
                      alt="Matched photo"
                      className="w-full h-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Selfie</p>
                  <div className="rounded-lg overflow-hidden bg-muted">
                    {match.selfieUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={match.selfieUrl}
                        alt={`${match.attendeeName} selfie`}
                        className="w-full h-auto object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-square flex items-center justify-center text-muted-foreground text-xs">
                        No selfie
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
