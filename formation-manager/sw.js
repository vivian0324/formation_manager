// Formation Manager — Service Worker
// Caches all app files for offline use.
// Update CACHE_NAME when deploying a new version to force a refresh.

const CACHE_NAME = 'formation-manager-v1';
const ASSETS = [
  '/formation_manager/',
  '/formation_manager/index.html',
  '/formation_manager/css/styles.css',
  '/formation_manager/js/state.js',
  '/formation_manager/js/dancers.js',
  '/formation_manager/js/formations.js',
  '/formation_manager/js/editor.js',
  '/formation_manager/js/optimizer.js',
  '/formation_manager/js/ui.js',
  '/formation_manager/manifest.json',
];

// Install: cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
