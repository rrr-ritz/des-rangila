"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchUploader } from "@/components/face/BatchUploader";
import { MatchReview } from "@/components/face/MatchReview";
import { Upload, UserCheck, ScanFace } from "lucide-react";

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
              Upload photographer photos below. The system detects faces in each photo
              and matches them against attendee selfies taken at check-in. Review and
              approve matches to link photos to attendee profiles.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload & Process
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Review Matches
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Review</CardTitle>
            </CardHeader>
            <CardContent>
              <MatchReview refreshTrigger={refreshTrigger} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
