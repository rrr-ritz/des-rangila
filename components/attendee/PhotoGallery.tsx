"use client";

import { useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoItem {
  id: string;
  thumbnailUrl: string;
  storageUrl: string;
  photoType: string;
  takenAt: unknown;
}

interface PhotoGalleryProps {
  photos: PhotoItem[];
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No photos yet.</p>
        <p className="text-sm mt-1">
          Visit a photo booth or check back after the event!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Your Photos</h2>
        <span className="text-sm text-muted-foreground">
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
            onClick={() => setSelectedPhoto(photo)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbnailUrl}
              alt="Event photo"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full">
            <button
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.storageUrl}
              alt="Event photo"
              className="w-full rounded-lg"
            />
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white/30 hover:bg-white/10"
                asChild
              >
                <a
                  href={selectedPhoto.storageUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
