"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 text-xs">
        <Wifi className="h-3 w-3" />
        <span>Online</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs">
      <WifiOff className="h-3 w-3" />
      <span>Offline — scans will sync when reconnected</span>
    </div>
  );
}
