"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, Check } from "lucide-react";

interface PhotoStripProps {
  photos: string[];
  onSave: (stripDataUrl: string, thumbnailDataUrl: string) => void;
  onRetake: () => void;
  saving?: boolean;
}

const PHOTO_WIDTH = 600;
const PHOTO_HEIGHT = 450;
const PADDING = 20;
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 60;
const GAP = 10;

export function PhotoStrip({ photos, onSave, onRetake, saving }: PhotoStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stripUrl, setStripUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || photos.length === 0) return;

    const totalWidth = PHOTO_WIDTH + PADDING * 2;
    const totalHeight =
      HEADER_HEIGHT +
      photos.length * PHOTO_HEIGHT +
      (photos.length - 1) * GAP +
      FOOTER_HEIGHT +
      PADDING * 2;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Header
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Des Rangila 2026", totalWidth / 2, PADDING + 40);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#a0a0c0";
    ctx.fillText("Tour of India", totalWidth / 2, PADDING + 62);

    // Load and draw each photo
    let loaded = 0;
    photos.forEach((dataUrl, i) => {
      const img = new Image();
      img.onload = () => {
        const y = HEADER_HEIGHT + PADDING + i * (PHOTO_HEIGHT + GAP);
        // White border around each photo
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(PADDING - 3, y - 3, PHOTO_WIDTH + 6, PHOTO_HEIGHT + 6);
        ctx.drawImage(img, PADDING, y, PHOTO_WIDTH, PHOTO_HEIGHT);

        loaded++;
        if (loaded === photos.length) {
          // Footer
          ctx.fillStyle = "#ffffff";
          ctx.font = "12px system-ui, sans-serif";
          ctx.textAlign = "center";
          const footerY = totalHeight - PADDING - 20;
          ctx.fillText(
            "ISA \u2022 University of Maryland \u2022 2026",
            totalWidth / 2,
            footerY
          );
          ctx.fillStyle = "#a0a0c0";
          ctx.font = "10px system-ui, sans-serif";
          ctx.fillText(
            "desrangila.app",
            totalWidth / 2,
            footerY + 16
          );

          setStripUrl(canvas.toDataURL("image/jpeg", 0.9));
        }
      };
      img.src = dataUrl;
    });
  }, [photos]);

  const handleSave = () => {
    if (!stripUrl || !canvasRef.current) return;

    // Generate thumbnail (400px wide)
    const thumbCanvas = document.createElement("canvas");
    const scale = 400 / canvasRef.current.width;
    thumbCanvas.width = 400;
    thumbCanvas.height = canvasRef.current.height * scale;
    const thumbCtx = thumbCanvas.getContext("2d");
    if (thumbCtx) {
      thumbCtx.drawImage(
        canvasRef.current,
        0,
        0,
        thumbCanvas.width,
        thumbCanvas.height
      );
    }
    const thumbUrl = thumbCanvas.toDataURL("image/jpeg", 0.7);
    onSave(stripUrl, thumbUrl);
  };

  const handleDownload = () => {
    if (!stripUrl) return;
    const a = document.createElement("a");
    a.href = stripUrl;
    a.download = `des-rangila-photobooth-${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Preview */}
      <div className="flex justify-center">
        <div className="max-w-xs w-full">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg shadow-xl"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onRetake} disabled={saving}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Retake
        </Button>
        <Button variant="outline" onClick={handleDownload} disabled={!stripUrl}>
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <Button onClick={handleSave} disabled={!stripUrl || saving}>
          <Check className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Love it!"}
        </Button>
      </div>
    </div>
  );
}
