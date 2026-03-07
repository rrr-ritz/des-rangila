"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, ImagePlus, Loader2, Check, AlertTriangle } from "lucide-react";

interface UploadResult {
  photoId: string;
  filename: string;
  matches: number;
  totalFaces: number;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
}

interface BatchUploaderProps {
  onBatchComplete: () => void;
}

export function BatchUploader({ onBatchComplete }: BatchUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter((f) =>
        f.type.startsWith("image/")
      );
      setFiles(selected);
      setResults([]);
    }
  };

  const processPhoto = useCallback(
    async (file: File): Promise<UploadResult> => {
      const filename = file.name;
      const result: UploadResult = {
        photoId: "",
        filename,
        matches: 0,
        totalFaces: 0,
        status: "processing",
      };

      try {
        // 1. Upload photo to server
        const formData = new FormData();
        formData.append("strip", file, file.name);
        formData.append("thumbnail", file, file.name);
        formData.append("attendeeIds", "[]");
        formData.append("photoType", "photographer");

        const uploadRes = await fetch("/api/photos/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          return { ...result, status: "error", error: "Upload failed" };
        }

        const uploadData = await uploadRes.json();
        result.photoId = uploadData.id;

        // 2. Load face detection models and detect faces in browser
        const { loadModels, extractAllDescriptors } = await import(
          "@/lib/face/detect"
        );
        await loadModels();

        // Create image element for face detection
        const imgUrl = URL.createObjectURL(file);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image load failed"));
          img.src = imgUrl;
        });

        const faces = await extractAllDescriptors(img);
        URL.revokeObjectURL(imgUrl);

        result.totalFaces = faces.length;

        if (faces.length === 0) {
          return { ...result, status: "done" };
        }

        // 3. Send faces to server for matching
        const matchRes = await fetch("/api/photos/face-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoId: result.photoId,
            faces: faces.map((f) => ({
              descriptor: Array.from(f.descriptor),
              box: f.box,
            })),
          }),
        });

        if (matchRes.ok) {
          const matchData = await matchRes.json();
          result.matches = matchData.matches;
        }

        return { ...result, status: "done" };
      } catch (err) {
        return {
          ...result,
          status: "error",
          error: err instanceof Error ? err.message : "Processing failed",
        };
      }
    },
    []
  );

  const startProcessing = async () => {
    setProcessing(true);
    const newResults: UploadResult[] = files.map((f) => ({
      photoId: "",
      filename: f.name,
      matches: 0,
      totalFaces: 0,
      status: "pending" as const,
    }));
    setResults(newResults);

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i);
      newResults[i] = { ...newResults[i], status: "processing" };
      setResults([...newResults]);

      const result = await processPhoto(files[i]);
      newResults[i] = result;
      setResults([...newResults]);
    }

    setProcessing(false);
    onBatchComplete();
  };

  const totalMatches = results.reduce((sum, r) => sum + r.matches, 0);
  const totalFaces = results.reduce((sum, r) => sum + r.totalFaces, 0);
  const doneCount = results.filter((r) => r.status === "done").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-4">
      {/* File selection */}
      {!processing && results.length === 0 && (
        <Card
          className="border-dashed border-2 cursor-pointer hover:border-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="p-8 text-center space-y-3">
            <ImagePlus className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">Upload photographer photos</p>
              <p className="text-sm text-muted-foreground">
                JPEG or PNG files from your camera
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </CardContent>
        </Card>
      )}

      {/* Selected files preview */}
      {files.length > 0 && results.length === 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {files.length} photo{files.length !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiles([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Clear
              </Button>
              <Button size="sm" onClick={startProcessing}>
                <Upload className="h-4 w-4 mr-2" />
                Process All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
            {files.map((file, i) => (
              <div
                key={i}
                className="aspect-square rounded bg-muted flex items-center justify-center overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing progress */}
      {results.length > 0 && (
        <div className="space-y-3">
          {processing && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                Processing {currentIndex + 1} of {files.length}...
              </span>
            </div>
          )}

          {!processing && (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">
                  {doneCount} processed, {errorCount} errors
                </span>
                <span className="text-muted-foreground ml-2">
                  {totalFaces} faces found, {totalMatches} matches
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiles([]);
                  setResults([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Upload More
              </Button>
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="h-2 bg-primary rounded-full transition-all"
              style={{
                width: `${(results.filter((r) => r.status !== "pending").length / results.length) * 100}%`,
              }}
            />
          </div>

          {/* Results list */}
          <div className="max-h-60 overflow-y-auto space-y-1">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50"
              >
                {r.status === "pending" && (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                )}
                {r.status === "processing" && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {r.status === "done" && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {r.status === "error" && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                <span className="flex-1 truncate">{r.filename}</span>
                {r.status === "done" && (
                  <span className="text-xs text-muted-foreground">
                    {r.totalFaces} face{r.totalFaces !== 1 ? "s" : ""},{" "}
                    {r.matches} match{r.matches !== 1 ? "es" : ""}
                  </span>
                )}
                {r.status === "error" && (
                  <span className="text-xs text-destructive">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
