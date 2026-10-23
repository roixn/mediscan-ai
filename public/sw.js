const CACHE_NAME = 'sahidawai-v1';
const URLS_TO_CACHE = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip API calls — always hit network for verification
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return new Response(
            '<html><body><h1 style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#065f46">SahiDawai</h1><p style="text-align:center;font-family:sans-serif">You\'re offline. Reconnect to verify health claims.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      });
    })
  );
});