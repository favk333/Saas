// Service worker : ouverture instantanée et lecture hors ligne.
// Pas de librairie : la logique tient en trois règles (voir fetch ci-dessous).

const VERSION = "v1";
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

// Déconnexion : la page demande l'effacement des données en cache.
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Jamais en cache : API, auth, pages client (/s/…), PDF, connexion.
  if (/^\/(api|auth|s|login)(\/|$)/.test(url.pathname) || url.pathname.endsWith("/pdf")) return;

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
