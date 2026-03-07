"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fullSync, flushRedemptionQueue } from "./sync";
import { getQueueLength } from "./db";

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const FLUSH_INTERVAL = 10 * 1000; // 10 seconds (for iOS fallback)

interface SyncStatus {
  lastSync: Date | null;
  syncing: boolean;
  queueLength: number;
  online: boolean;
}

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>({
    lastSync: null,
    syncing: false,
    queueLength: 0,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  });
  const syncingRef = useRef(false);

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setStatus((prev) => ({ ...prev, syncing: true }));

    try {
      await fullSync();
      const queueLen = await getQueueLength();
      setStatus((prev) => ({
        ...prev,
        lastSync: new Date(),
        syncing: false,
        queueLength: queueLen,
      }));
    } catch {
      setStatus((prev) => ({ ...prev, syncing: false }));
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const doFlush = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const flushed = await flushRedemptionQueue();
      if (flushed > 0) {
        const queueLen = await getQueueLength();
        setStatus((prev) => ({ ...prev, queueLength: queueLen }));
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    // Online/offline listeners
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, online: true }));
      doFlush(); // Immediately try to flush when coming back online
    };
    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, online: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync
    doSync();

    // Periodic full sync (every 5 minutes)
    const syncInterval = setInterval(doSync, SYNC_INTERVAL);

    // iOS fallback: periodic flush (every 10 seconds)
    const flushInterval = setInterval(doFlush, FLUSH_INTERVAL);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(syncInterval);
      clearInterval(flushInterval);
    };
  }, [doSync, doFlush]);

  // Update queue length periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const len = await getQueueLength();
        setStatus((prev) => ({ ...prev, queueLength: len }));
      } catch {
        // Silently fail
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    ...status,
    sync: doSync,
    flush: doFlush,
  };
}
