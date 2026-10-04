"use client";

import { useEffect } from "react";

/** Enregistre /sw.js en production (en dev, le cache gênerait le rechargement à chaud). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

/** À la déconnexion : efface les pages en cache (elles contiennent les données de l'artisan). */
export async function clearCachedPages() {
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-pages");
    await caches.delete("pages");
  } catch {}
}
