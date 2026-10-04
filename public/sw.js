// Service worker : ouverture instantanée et lecture hors ligne.
// Pas de librairie : la logique tient en trois règles (voir fetch ci-dessous).

const VERSION = "v3";
const STATIC = `static-${VERSION}`; // fichiers versionnés de Next + icônes
const PAGES = "pages"; // dernières pages vues (données de l'artisan, effacé à la déconnexion)
const OFFLINE = "/offline.html";
const NETWORK_TIMEOUT = 3000; // réseau faible sur chantier : on n'attend pas plus

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("static-") && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Déconnexion : effacement des pages en cache (données de l'artisan).
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
  // Réseau revenu, app ouverte, ou soumission mise en attente : on vide la file.
  if (event.data === "flush-outbox") event.waitUntil(flushOutbox());
  // Après connexion : met en cache les pages utiles hors ligne.
  if (event.data?.type === "warm") event.waitUntil(warm(event.data.urls));
});

// Android / Chrome : envoi en arrière-plan même app fermée (Background Sync).
self.addEventListener("sync", (event) => {
  if (event.tag === "outbox") event.waitUntil(flushOutbox());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Jamais en cache : API, auth, connexion, PDF.
  // Les pages client /s/… le sont : sur le téléphone du client, elles ne contiennent que sa soumission,
  // et il doit pouvoir la rouvrir et la signer sans réseau.
  if (/^\/(api|auth|login)(\/|$)/.test(url.pathname) || url.pathname.endsWith("/pdf")) return;

  // 1. Fichiers versionnés (hash dans le nom) : cache d'abord, immuables.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 2. Pages : réseau d'abord (3 s max), sinon dernière version vue, sinon page hors ligne.
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, event));
  }
  // 3. Le reste (requêtes RSC de Next…) passe directement au réseau. Hors ligne,
  //    Next bascule alors sur une navigation classique, servie par la règle 2.
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) (await caches.open(STATIC)).put(req, res.clone());
  return res;
}

async function networkFirst(req, event) {
  const cache = await caches.open(PAGES);
  const network = fetch(req).then((res) => {
    // Pas de mise en cache d'une redirection vers /login ni d'une erreur.
    if (res.ok && !res.redirected) event.waitUntil(cache.put(req, res.clone()));
    return res;
  });
  network.catch(() => {}); // échec traité plus bas ; évite un rejet non géré si le cache a déjà répondu

  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT, null));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    // Réseau trop lent : version en cache si on en a une, sinon on continue d'attendre.
    return (await cache.match(req)) ?? (await network);
  } catch {
    return (await cache.match(req)) ?? (await caches.match(OFFLINE));
  }
}

// Met en cache une page jamais ouverte ET ses fichiers JS / CSS : sans eux,
// la page s'afficherait hors ligne mais resterait inerte.
async function warm(urls) {
  const pages = await caches.open(PAGES);
  const statics = await caches.open(STATIC);
  await Promise.all(
    (urls ?? []).map(async (url) => {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        // Une redirection vers /login (session expirée) n'est pas mise en cache.
        if (!res.ok || res.redirected) return;
        const html = await res.clone().text();
        await pages.put(url, res);
        const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
        await Promise.all(
          assets.map(async (asset) => {
            if (await statics.match(asset)) return;
            const a = await fetch(asset);
            if (a.ok) await statics.put(asset, a);
          }),
        );
      } catch {}
    }),
  );
}

// ---- File d'attente des soumissions faites hors ligne ----
// Même base que lib/outbox.ts (côté page) : garder OUTBOX_DB / OUTBOX_STORE identiques.

const OUTBOX_DB = "chantier";
const OUTBOX_STORE = "outbox";

function openOutbox() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(OUTBOX_STORE, mode);
    const result = fn(t.objectStore(OUTBOX_STORE));
    t.oncomplete = () => resolve(result?.result);
    t.onerror = () => reject(t.error);
  });
}

async function notifyClients() {
  for (const client of await self.clients.matchAll()) client.postMessage({ type: "outbox-changed" });
}

let flushing = null; // un seul envoi à la fois : pas de double SMS ni de double signature

function flushOutbox() {
  flushing ??= doFlush().finally(() => (flushing = null));
  return flushing;
}

async function doFlush() {
  const db = await openOutbox();
  const items = await tx(db, "readonly", (store) => store.getAll());
  let retryLater = false;

  for (const item of items ?? []) {
    if (item.status === "failed") continue;
    let res;
    try {
      // Soumission de l'artisan, ou signature du client sur le lien /s/[token].
      const remote = item.kind === "remote";
      res = await fetch(remote ? "/api/remote-sign" : "/api/offline-sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(remote ? { token: item.token, signature: item.signature, signedAt: item.signedAt } : item),
      });
    } catch {
      retryLater = true; // toujours pas de réseau
      break;
    }
    if (res.ok) {
      await tx(db, "readwrite", (store) => store.delete(item.id));
    } else if (res.status === 409 || res.status === 422) {
      const { error } = await res.json().catch(() => ({ error: "Envoi refusé." }));
      await tx(db, "readwrite", (store) => store.put({ ...item, status: "failed", error }));
    } else {
      retryLater = true; // session expirée, serveur ou SMS indisponible
      const { error } = await res.json().catch(() => ({ error: null }));
      await tx(db, "readwrite", (store) => store.put({ ...item, lastError: error }));
    }
    await notifyClients();
  }
  db.close();
  // Background Sync : une erreur demande au navigateur de réessayer plus tard.
  if (retryLater) throw new Error("outbox: nouvel essai plus tard");
}
