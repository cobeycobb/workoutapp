/* Lightweight service worker for offline support */
const VERSION = 'v1';
const SCOPE_URL = new URL(self.registration.scope);
const BASE = SCOPE_URL.pathname.endsWith('/') ? SCOPE_URL.pathname : SCOPE_URL.pathname + '/';
const CACHE_NAME = `workout-cache-${VERSION}`;

const CORE = [
  BASE + 'home_screen_mockup.html',
  BASE + 'exercise_detail_mockup.html',
  BASE + 'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // For navigations (HTML pages), use network-first with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, net.clone());
          return net;
        } catch (e) {
          const cached = await caches.match(req);
          if (cached) return cached;
          // Last resort: serve home
          return caches.match(BASE + 'home_screen_mockup.html');
        }
      })()
    );
    return;
  }

  // For same-origin assets, cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
        return net;
      } catch (e) {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});

