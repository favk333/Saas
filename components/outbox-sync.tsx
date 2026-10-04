"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { requestFlush } from "@/lib/outbox";

// Pages mises en cache (avec leurs JS / CSS) pour être utilisables sans réseau.
const ARTISAN_PAGES = ["/", "/soumissions/nouveau"];

/**
 * Déclenche l'envoi de la file hors ligne : à l'ouverture, au retour du réseau,
 * au retour dans l'app. Rafraîchit l'accueil quand le service worker a envoyé quelque chose.
 */
export function OutboxSync({ warmUrls = ARTISAN_PAGES }: { warmUrls?: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const flush = () => navigator.onLine && requestFlush();
    const onVisible = () => document.visibilityState === "visible" && flush();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "outbox-changed" && navigator.onLine) router.refresh();
    };

    flush();
    if (navigator.onLine) {
      navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: "warm", urls: warmUrls })).catch(() => {});
    }
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return null;
}
