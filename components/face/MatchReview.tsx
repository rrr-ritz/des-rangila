"use client";

import { useState, useCallback, useEffect } from "react";
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
        if (data.stats && onStatsUpdate) {
          onStatsUpdate(data.stats);
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

  const handleAction = async (matchId: string, action: "approve" | "reject") => {
    if (!user) return;
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
        setMatches((prev) => prev.filter((m) => m.id !== matchId));
      }
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAll = async () => {
    for (const match of matches) {
      await handleAction(match.id, "approve");
    }
  };

  const handleRejectAll = async () => {
    for (const match of matches) {
      await handleAction(match.id, "reject");
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
              <Button size="sm" onClick={handleApproveAll}>
                <Check className="h-4 w-4 mr-2" />
                Approve All
              </Button>
              <Button size="sm" variant="destructive" onClick={handleRejectAll}>
                <X className="h-4 w-4 mr-2" />
                Reject All
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {matches.map((match) => (
          <Card key={match.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Side-by-side photos */}
                <div className="flex gap-3 shrink-0">
                  {/* Photographer photo */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Photo</p>
                    <div className="w-40 h-40 rounded-lg overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={match.photoUrl}
                        alt="Matched photo"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>

                  {/* Attendee selfie */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Selfie</p>
                    <div className="w-40 h-40 rounded-lg overflow-hidden bg-muted">
                      {match.selfieUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={match.selfieUrl}
                          alt={`${match.attendeeName} selfie`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No selfie
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Match details + actions */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm">{match.attendeeName}</p>
                      {statusBadge(match.status)}
                    </div>

                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono font-bold ${confidenceBg(match.confidence)} ${confidenceColor(match.confidence)}`}>
                      {match.confidence.toFixed(3)}
                    </div>
                  </div>

                  {showActions && (
                    <div className="flex gap-2 mt-3">
                      {(match.status === "pending" || match.status === "auto-approved") && (
                        <>
                          {match.status === "pending" && (
                            <Button
                              size="sm"
                              className="h-8"
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
                            className="h-8"
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
