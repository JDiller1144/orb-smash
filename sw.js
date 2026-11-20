// Service Worker: legt alle Dateien beim ersten Besuch auf dem Geraet ab,
// damit das Spiel danach komplett offline startet.
// Bei jeder Aenderung am Spiel VERSION hochzaehlen, sonst bleibt die alte Fassung im Cache.

const VERSION = 'orbsmash-v1.2.0';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/main.js',
  './js/game.js',
  './js/audio.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Erst im Cache schauen, nur wenn dort nichts liegt ins Netz
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    })),
  );
});
