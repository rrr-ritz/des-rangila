"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  total: number;
}

export function CSVImporter() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
  }, []);

  async function handleUpload() {
    if (!file || !user) return;
    setLoading(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/attendees/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import Attendees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop a CSV file, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Required columns: <code>name</code>, <code>email</code>
          </p>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            id="csv-upload"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button variant="outline" size="sm" asChild>
            <label htmlFor="csv-upload" className="cursor-pointer">
              Choose File
            </label>
          </Button>
        </div>

        {file && (
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{file.name}</span>
            <Button onClick={handleUpload} disabled={loading} size="sm">
              {loading ? "Importing..." : "Import"}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="text-sm space-y-1 bg-muted/50 rounded-md p-3">
            <p className="font-medium">Import Complete</p>
            <p>{result.imported} attendees imported</p>
            {result.duplicates > 0 && (
              <p className="text-muted-foreground">
                {result.duplicates} duplicates skipped
              </p>
            )}
            {result.errors > 0 && (
              <p className="text-destructive">{result.errors} errors</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
