// Flow service worker — makes the site installable and usable offline.
// Pages and assets: network first (so updates show up), cache as fallback.
// Sheet reads (Apps Script) are never cached here; the app already falls back
// to its built-in snapshot when they fail.
const CACHE_PREFIX = `flow-${self.registration.scope}-`;
const CACHE = `${CACHE_PREFIX}v4`;
const SHELL = ['./', './index.html', './css/styles.css', './js/config.js', './js/data.js', './js/activity.js', './js/app.js', './js/install.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/icon.svg', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith(CACHE_PREFIX) || k === 'flow-v3c') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)));
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(e.request, { ignoreSearch: true });
        if (hit) return hit;
        if (e.request.mode === 'navigate') return cache.match('./index.html');
        return Response.error();
      })
  );
});
