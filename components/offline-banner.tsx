"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-ink px-4 pt-[env(safe-area-inset-top)] text-[13px] font-medium text-white">
      <span className="flex h-8 items-center gap-2">
        <WifiOff size={14} strokeWidth={2} aria-hidden />
        Hors ligne · dernières données enregistrées
      </span>
    </div>
  );
}
