"use client";

// File d'attente des soumissions faites hors ligne (IndexedDB, sur le téléphone).
// L'envoi est fait par le service worker (public/sw.js), qui lit la même base :
// garder OUTBOX_DB / OUTBOX_STORE identiques des deux côtés.

import { useCallback, useEffect, useState } from "react";
import type { QuoteFields } from "./quote";

const OUTBOX_DB = "chantier";
const OUTBOX_STORE = "outbox";

export type OutboxItem = {
  id: string; // identifiant final de la soumission (créé sur le téléphone)
  userId: string;
  intent: "sign" | "sms";
  fields: QuoteFields;
  totalCents: number; // pour l'affichage en attendant l'envoi
  signature?: string; // PNG en data URL
  signedAt?: string;
  createdAt: string;
  status?: "failed";
  error?: string; // échec définitif (affiché)
  lastError?: string | null; // dernier échec temporaire
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(OUTBOX_STORE, mode);
      const req = fn(t.objectStore(OUTBOX_STORE));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

export async function addToOutbox(item: OutboxItem) {
  await run("readwrite", (s) => s.put(item));
  requestFlush();
}

export async function removeFromOutbox(id: string) {
  await run("readwrite", (s) => s.delete(id));
  window.dispatchEvent(new Event("outbox-changed"));
}

export async function listOutbox(userId: string): Promise<OutboxItem[]> {
  try {
    const all = (await run<OutboxItem[]>("readonly", (s) => s.getAll())) ?? [];
    return all.filter((i) => i.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return []; // navigation privée, stockage bloqué…
  }
}

/** Demande au service worker d'envoyer la file ; en arrière-plan si le navigateur le permet. */
export async function requestFlush() {
  window.dispatchEvent(new Event("outbox-changed"));
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage("flush-outbox");
    // Background Sync (Android / Chrome) : relance automatique quand le réseau revient.
    await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register("outbox");
  } catch {}
}

/** Liste à jour : se rafraîchit quand le service worker ou la page modifie la file. */
export function useOutbox(userId: string) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const refresh = useCallback(() => {
    listOutbox(userId).then(setItems);
  }, [userId]);

  useEffect(() => {
    refresh();
    const onMessage = (e: MessageEvent) => e.data?.type === "outbox-changed" && refresh();
    window.addEventListener("outbox-changed", refresh);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("outbox-changed", refresh);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [refresh]);

  return { items, refresh };
}
