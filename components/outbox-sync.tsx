"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { requestFlush } from "@/lib/outbox";

// Pages ouvertes au moins une fois en ligne, pour qu'une soumission puisse être faite sans réseau.
const OFFLINE_PAGES = ["/", "/soumissions/nouveau"];

/**
 * Déclenche l'envoi de la file hors ligne : à l'ouverture, au retour du réseau,
 * au retour dans l'app. Rafraîchit l'accueil quand le service worker a envoyé quelque chose.
 */
export function OutboxSync() {
  const router = useRouter();

  useEffect(() => {
    const flush = () => navigator.onLine && requestFlush();
    const onVisible = () => document.visibilityState === "visible" && flush();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "outbox-changed" && navigator.onLine) router.refresh();
    };

    flush();
    if (navigator.onLine) {
      navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: "warm", urls: OFFLINE_PAGES })).catch(() => {});
    }
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
