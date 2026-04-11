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
const BORDER = 24;
const PHOTO_GAP = 8;
const BRANDING_HEIGHT = 200;

export function PhotoStrip({ photos, onSave, onRetake, saving }: PhotoStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stripUrl, setStripUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || photos.length === 0) return;

    const totalWidth = PHOTO_WIDTH + BORDER * 2;
    const photosHeight =
      photos.length * PHOTO_HEIGHT + (photos.length - 1) * PHOTO_GAP;
    const totalHeight = BORDER + photosHeight + BRANDING_HEIGHT + BORDER;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Full dark background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Load and draw each photo in B&W
    let loaded = 0;
    photos.forEach((dataUrl, i) => {
      const img = new Image();
      img.onload = () => {
        const x = BORDER;
        const y = BORDER + i * (PHOTO_HEIGHT + PHOTO_GAP);

        // Draw photo in grayscale — edge-to-edge, no individual borders
        ctx.filter = "grayscale(100%)";
        ctx.drawImage(img, x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
        ctx.filter = "none";

        loaded++;
        if (loaded === photos.length) {
          // Branding section — centered below photos
          const brandingTop = BORDER + photosHeight;
          const brandingCenter = brandingTop + BRANDING_HEIGHT / 2;

          // "Des Rangila" — large bold serif
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 36px Georgia, 'Playfair Display', serif";
          ctx.textAlign = "center";
          ctx.fillText("Des Rangila", totalWidth / 2, brandingCenter - 24);

          // Thin horizontal line
          const lineWidth = totalWidth * 0.3;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo((totalWidth - lineWidth) / 2, brandingCenter - 6);
          ctx.lineTo((totalWidth + lineWidth) / 2, brandingCenter - 6);
          ctx.stroke();

          // Date
          ctx.fillStyle = "#ffffff";
          ctx.font = "16px Georgia, 'Playfair Display', serif";
          ctx.fillText("04.11.26", totalWidth / 2, brandingCenter + 18);

          // "UMD INDIAN STUDENT ASSOCIATION"
          ctx.fillStyle = "#ffffff";
          ctx.font = "10px system-ui, sans-serif";
          ctx.letterSpacing = "3px";
          ctx.fillText(
            "UMD INDIAN STUDENT ASSOCIATION",
            totalWidth / 2,
            brandingCenter + 48
          );
          ctx.letterSpacing = "0px";

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
