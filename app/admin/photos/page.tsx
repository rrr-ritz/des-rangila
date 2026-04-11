"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Camera, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface PhotoData {
  id: string;
  attendeeIds: string[];
  photoType: string;
  storageUrl: string;
  thumbnailUrl: string;
  approved: boolean;
  takenAt: { _seconds?: number; seconds?: number };
}

export default function PhotosPage() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);

  const fetchPhotos = useCallback(async (startAfter?: string) => {
    if (!user) return;
    if (!startAfter) setLoading(true);
    else setLoadingMore(true);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ limit: "20" });
      if (startAfter) params.set("startAfter", startAfter);

      const res = await fetch(`/api/admin/photos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (startAfter) {
          setPhotos((prev) => [...prev, ...(data.photos || [])]);
        } else {
          setPhotos(data.photos || []);
        }
        setHasMore(data.hasMore || false);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const loadMore = () => {
    if (photos.length > 0) {
      fetchPhotos(photos[photos.length - 1].id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Photos</h1>
          <p className="text-sm text-muted-foreground">
            Photo booth gallery
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchPhotos()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{photos.length}{hasMore ? "+" : ""}</p>
              <p className="text-xs text-muted-foreground">Booth Photos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{photos.length}{hasMore ? "+" : ""}</p>
              <p className="text-xs text-muted-foreground">Total Photos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Photos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No photos yet.</p>
              <p className="text-sm mt-1">
                Photos will appear here once the booth is in use.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    className="aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors relative"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnailUrl || photo.storageUrl}
                      alt="Event photo"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-1 right-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {photo.photoType}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
              {hasMore && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.storageUrl}
              alt="Event photo"
              className="w-full rounded-lg"
            />
            <div className="flex items-center justify-between mt-3">
              <Badge>{selectedPhoto.photoType}</Badge>
              <span className="text-sm text-white/70">
                {selectedPhoto.attendeeIds.length} attendee
                {selectedPhoto.attendeeIds.length !== 1 ? "s" : ""} linked
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
