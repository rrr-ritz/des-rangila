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
const PADDING = 30;
const HEADER_HEIGHT = 70;
const FOOTER_HEIGHT = 50;
const GAP = 10;
const FRAME = 10;

export function PhotoStrip({ photos, onSave, onRetake, saving }: PhotoStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stripUrl, setStripUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || photos.length === 0) return;

    const innerWidth = PHOTO_WIDTH + PADDING * 2;
    const innerHeight =
      HEADER_HEIGHT +
      photos.length * PHOTO_HEIGHT +
      (photos.length - 1) * GAP +
      FOOTER_HEIGHT +
      PADDING * 2;

    const totalWidth = innerWidth + FRAME * 2;
    const totalHeight = innerHeight + FRAME * 2;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mahogany frame
    ctx.fillStyle = "#483932";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Cream interior
    ctx.fillStyle = "#FDF8F0";
    ctx.fillRect(FRAME, FRAME, innerWidth, innerHeight);

    // Header
    ctx.fillStyle = "#483932";
    ctx.font = "20px Georgia, 'Playfair Display', serif";
    ctx.textAlign = "center";
    ctx.fillText("Des Rangila", totalWidth / 2, FRAME + PADDING + 32);
    ctx.fillStyle = "#8C7B6B";
    ctx.font = "11px Georgia, 'Playfair Display', serif";
    ctx.fillText("Tour of India", totalWidth / 2, FRAME + PADDING + 50);

    // Load and draw each photo in B&W
    let loaded = 0;
    photos.forEach((dataUrl, i) => {
      const img = new Image();
      img.onload = () => {
        const y = FRAME + HEADER_HEIGHT + PADDING + i * (PHOTO_HEIGHT + GAP);
        const x = FRAME + PADDING;

        // Sand border around each photo
        ctx.fillStyle = "#E8DFD0";
        ctx.fillRect(x - 3, y - 3, PHOTO_WIDTH + 6, PHOTO_HEIGHT + 6);

        // Draw photo in grayscale
        ctx.filter = "grayscale(100%)";
        ctx.drawImage(img, x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
        ctx.filter = "none";

        loaded++;
        if (loaded === photos.length) {
          // Footer
          ctx.fillStyle = "#8C7B6B";
          ctx.font = "11px Georgia, 'Playfair Display', serif";
          ctx.textAlign = "center";
          const footerY = totalHeight - FRAME - PADDING - 16;
          ctx.fillText(
            "Tour of India \u00b7 April 11, 2026",
            totalWidth / 2,
            footerY
          );
          ctx.font = "10px Georgia, 'Playfair Display', serif";
          ctx.fillText(
            "ISA \u00b7 University of Maryland",
            totalWidth / 2,
            footerY + 15
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
