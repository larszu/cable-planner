// Minimaler Service-Worker für die PWA (Handy-App).
//
// Ziel: Installierbarkeit + Offline-Fähigkeit ohne fragile Vorab-Cache-Listen.
// Strategie: runtime cache-on-fetch für same-origin GETs (Vite-gehashte Assets
// sind unveränderlich → cachen ist sicher). Navigations-Fallback auf die
// gecachte Einstiegsseite, damit die App auch offline startet.
const CACHE = 'planner-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      // Stale-while-revalidate: sofort aus Cache, sonst Netz.
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      // Offline + nicht gecacht: bei Navigationen die Einstiegsseite liefern.
      if (req.mode === 'navigate') {
        const fallback = (await cache.match('index.html')) || (await cache.match('./')) || (await cache.match('/'));
        if (fallback) return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })(),
  );
});
