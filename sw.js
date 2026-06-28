/* PM Scanner — Service Worker
   Bump CACHE_VERSION on every deploy to trigger auto-update. */
const CACHE_VERSION = '2026-06-28-v28';
const CACHE_NAME    = 'pm-scanner-' + CACHE_VERSION;
const FILE          = '/Polymarket-Scanner/polymarket-combined.html';

/* Install — cache the main file */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.add(FILE))
      .then(() => self.skipWaiting()) /* activate immediately */
  );
});

/* Activate — delete all old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) /* take control immediately */
  );
});

/* Fetch — network first, fall back to cache */
self.addEventListener('fetch', e => {
  if (!e.request.url.includes('polymarket-combined.html')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        /* Update cache with fresh response */
        caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(FILE)) /* offline fallback */
  );
});
