"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchUploader } from "@/components/face/BatchUploader";
import { MatchReview } from "@/components/face/MatchReview";
import { Upload, UserCheck, ScanFace, ShieldCheck, AlertTriangle, List } from "lucide-react";

export default function FaceRecognitionPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleBatchComplete = () => {
    // Trigger a refresh of the match review
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Face Recognition</h1>
        <p className="text-sm text-muted-foreground">
          Upload photographer photos and match faces to attendees
        </p>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="p-4 flex gap-3">
          <ScanFace className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              How it works
            </p>
            <p className="text-blue-700 dark:text-blue-300">
              After the event, run the InsightFace matching script to process photographer photos
              against attendee selfies. High-confidence matches (&gt;0.3 similarity) are
              auto-approved. Borderline matches (0.2–0.3) need manual review below.
              You can also upload photos directly for browser-based matching.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="review" className="space-y-4">
        <TabsList>
          <TabsTrigger value="review" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Review Matches
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
                <CardHeader>
                  <CardTitle className="text-base">Pending Review</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Borderline matches (0.2–0.3 similarity) that need human verification
                  </p>
                </CardHeader>
                <CardContent>
                  <MatchReview
                    refreshTrigger={refreshTrigger}
                    statusFilter="pending"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auto-approved">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Auto-Approved Matches</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    High-confidence matches (&gt;0.3 similarity) automatically linked to attendee galleries. Revoke if incorrect.
                  </p>
                </CardHeader>
                <CardContent>
                  <MatchReview
                    refreshTrigger={refreshTrigger}
                    statusFilter="auto-approved"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All Matches</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Complete audit view of all face match results
                  </p>
                </CardHeader>
                <CardContent>
                  <MatchReview
                    refreshTrigger={refreshTrigger}
                    statusFilter="all"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
