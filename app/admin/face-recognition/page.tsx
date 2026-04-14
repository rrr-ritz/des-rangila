"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchUploader } from "@/components/face/BatchUploader";
import { MatchReview } from "@/components/face/MatchReview";
import { AttendeePreview } from "@/components/face/AttendeePreview";
import { Upload, UserCheck, ScanFace, ShieldCheck, AlertTriangle, List, Users } from "lucide-react";

export default function FaceRecognitionPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({ autoApproved: 0, pending: 0, rejected: 0, approved: 0 });

  const handleBatchComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Face Recognition</h1>
        <p className="text-sm text-muted-foreground">
          Match photographer photos to attendee selfies
        </p>
      </div>

      {/* Stats bar — compact, info-blue style */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="p-3 flex items-center gap-6">
          <ScanFace className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex gap-6 text-sm">
            <div>
              <span className="font-bold text-green-700 dark:text-green-400">{stats.autoApproved}</span>
              <span className="text-muted-foreground ml-1">auto-approved</span>
            </div>
            <div>
              <span className="font-bold text-amber-700 dark:text-amber-400">{stats.pending}</span>
              <span className="text-muted-foreground ml-1">needs review</span>
            </div>
            <div>
              <span className="font-bold text-blue-700 dark:text-blue-400">{stats.approved}</span>
              <span className="text-muted-foreground ml-1">approved</span>
            </div>
            <div>
              <span className="font-bold text-muted-foreground">{stats.rejected}</span>
              <span className="text-muted-foreground ml-1">rejected</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="review" className="space-y-4">
        <TabsList>
          <TabsTrigger value="review" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Review Matches
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Users className="h-4 w-4" />
            Attendee Preview
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload & Process
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Needs Review
              </TabsTrigger>
              <TabsTrigger value="auto-approved" className="gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                Auto-Approved
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                <List className="h-3.5 w-3.5" />
                All Matches
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pending Review</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Compare the photographer photo against the attendee selfie. Approve if they match.
                  </p>
                </CardHeader>
                <CardContent>
                  <MatchReview
                    refreshTrigger={refreshTrigger}
                    statusFilter="pending"
                    onStatsUpdate={setStats}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auto-approved">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Auto-Approved</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    High-confidence matches (&gt;0.55 similarity, clear gap from second-best). Revoke if incorrect.
                  </p>
                </CardHeader>
                <CardContent>
                  <MatchReview
                    refreshTrigger={refreshTrigger}
                    statusFilter="auto-approved"
                    onStatsUpdate={setStats}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">All Matches</CardTitle>
                </CardHeader>
                <CardContent>
                  <MatchReview
                    refreshTrigger={refreshTrigger}
                    statusFilter="all"
                    onStatsUpdate={setStats}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="preview">
          <div className="space-y-2">
            <div>
              <h2 className="text-base font-semibold">Final Review — Attendee Gallery</h2>
              <p className="text-xs text-muted-foreground">
                Spot-check each attendee&apos;s final photo set before delivery. Remove any photos that don&apos;t belong.
              </p>
            </div>
            <AttendeePreview />
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Batch Upload</CardTitle>
            </CardHeader>
            <CardContent>
              <BatchUploader onBatchComplete={handleBatchComplete} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
