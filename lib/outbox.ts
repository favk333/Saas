"use client";

// File d'attente des soumissions faites hors ligne (IndexedDB, sur le téléphone).
// L'envoi est fait par le service worker (public/sw.js), qui lit la même base :
// garder OUTBOX_DB / OUTBOX_STORE identiques des deux côtés.

import { useCallback, useEffect, useState } from "react";
import type { QuoteFields } from "./quote";

const OUTBOX_DB = "chantier";
const OUTBOX_STORE = "outbox";

/** Soumission faite hors ligne par l'artisan (envoyée à /api/offline-sync). */
export type OutboxItem = {
  kind?: "quote";
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

/** Signature faite hors ligne par le client, sur le lien /s/[token] (envoyée à /api/remote-sign). */
export type RemoteSignItem = {
  kind: "remote";
  id: string; // "remote:<token>" : une seule signature en attente par lien
  token: string;
  signature: string;
  signedAt: string;
  createdAt: string;
  status?: "failed";
  error?: string;
  lastError?: string | null;
};

type AnyItem = OutboxItem | RemoteSignItem;
const isRemote = (i: AnyItem): i is RemoteSignItem => i.kind === "remote";

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

export async function addToOutbox(item: AnyItem) {
  await run("readwrite", (s) => s.put(item));
  requestFlush();
}

export async function removeFromOutbox(id: string) {
  await run("readwrite", (s) => s.delete(id));
  window.dispatchEvent(new Event("outbox-changed"));
}

export async function listOutbox(userId: string): Promise<OutboxItem[]> {
  try {
    const all = (await run<AnyItem[]>("readonly", (s) => s.getAll())) ?? [];
    return all
      .filter((i): i is OutboxItem => !isRemote(i) && i.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return []; // navigation privée, stockage bloqué…
  }
}

/** Signature du client en attente pour ce lien, s'il y en a une sur ce téléphone. */
export async function getRemotePending(token: string): Promise<RemoteSignItem | null> {
  try {
    return ((await run<AnyItem>("readonly", (s) => s.get(`remote:${token}`))) as RemoteSignItem | undefined) ?? null;
  } catch {
    return null;
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
