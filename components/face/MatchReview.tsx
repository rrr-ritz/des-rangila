"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, RefreshCw, Loader2 } from "lucide-react";

interface MatchItem {
  id: string;
  photoId: string;
  photoUrl: string;
  attendeeId: string;
  attendeeName: string;
  confidence: number;
  faceBox: { x: number; y: number; width: number; height: number };
  status: string;
  createdAt: { _seconds?: number; seconds?: number };
}

interface MatchReviewProps {
  refreshTrigger: number;
}

export function MatchReview({ refreshTrigger }: MatchReviewProps) {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/photos/face-match/queue?status=pending&limit=50");
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

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
    return (
      <div className="text-center py-8 text-muted-foreground space-y-2">
        <p>No pending matches to review.</p>
        <Button variant="outline" size="sm" onClick={fetchMatches}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {matches.length} pending match{matches.length !== 1 ? "es" : ""}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMatches}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {matches.length > 1 && (
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
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{match.attendeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        Match confidence
                      </p>
                    </div>
                    <Badge
                      variant={
                        match.confidence >= 80
                          ? "default"
                          : match.confidence >= 60
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {match.confidence}%
                    </Badge>
                  </div>

                  <div className="flex gap-2">
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
