/* Service-Worker: App-Shell + Offline-Fähigkeit für das Schiedsrichter-Tablet.
   - Gleiche Origin: network-first (immer aktuell online), Offline-Fallback aus Cache.
   - Supabase-Bibliothek (CDN): cache-first, damit der Store auch offline im
     Supabase-Modus startet (wichtig für spätere Synchronisierung).
   - Übrige Cross-Origin-Anfragen (z.B. Flaggen): direkt aus dem Netz. */
const CACHE = 'squash-schiri-v7';
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const SAME = [
  'tablet.html', 'court.html', 'config.js', 'store.js', 'auth.js', 'i18n.js', 'ranking.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try { await c.addAll(SAME.map(a => new Request(a, { cache: 'reload' }))); } catch (err) {}
    try { await c.add(CDN); } catch (err) {}
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Supabase-Bibliothek: cache-first (offline verfügbar halten)
  if (e.request.url.indexOf(CDN) === 0) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    })));
    return;
  }
  // Gleiche Origin: network-first mit Cache-Fallback
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // Sonstiges Cross-Origin (Flaggen etc.): normales Netz
});
