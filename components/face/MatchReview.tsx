"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, RefreshCw, Loader2, ShieldCheck, AlertTriangle, Ban } from "lucide-react";

interface MatchItem {
  id: string;
  photoId: string;
  photoUrl: string;
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
}

function getStatusBadge(status: string) {
  switch (status) {
    case "auto-approved":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800">
          <ShieldCheck className="h-3 w-3 mr-1" />
          High confidence
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Needs review
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800">
          <Check className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          <Ban className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function MatchReview({ refreshTrigger, statusFilter = "pending" }: MatchReviewProps) {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/photos/face-match/queue?status=${statusFilter}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches, refreshTrigger]);

  const handleAction = async (matchId: string, action: "approve" | "reject") => {
    setActionLoading(matchId);
    try {
      const res = await fetch(`/api/photos/face-match/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
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

  // Determine if we should show action buttons
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
            <Button size="sm" onClick={handleApproveAll}>
              <Check className="h-4 w-4 mr-2" />
              Approve All
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {matches.map((match) => (
          <Card key={match.id}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Photo preview */}
                <div className="shrink-0 w-32 h-24 rounded overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={match.photoUrl}
                    alt="Matched photo"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Match details */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{match.attendeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        Similarity: {match.confidence}
                      </p>
                    </div>
                    {getStatusBadge(match.status)}
                  </div>

                  {showActions && (
                    <div className="flex gap-2">
                      {/* Pending matches: Approve / Reject */}
                      {match.status === "pending" && (
                        <>
                          <Button
                            size="sm"
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(match.id, "reject")}
                            disabled={actionLoading === match.id}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}

                      {/* Auto-approved matches: Revoke (reject) */}
                      {match.status === "auto-approved" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(match.id, "reject")}
                          disabled={actionLoading === match.id}
                        >
                          {actionLoading === match.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <X className="h-3 w-3 mr-1" />
                          )}
                          Revoke
                        </Button>
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
