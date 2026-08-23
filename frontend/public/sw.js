const CACHE_NAME = 'zarfolio-pwa-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
];

// Sensitive routes that should never be cached
const SENSITIVE_ROUTES = [
  '/api/',
  '/dashboard/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude sensitive financial data and API routes from caching
  const isSensitive = SENSITIVE_ROUTES.some(route => url.pathname.includes(route));

  if (isSensitive) {
    // Network only strategy for sensitive data
    event.respondWith(fetch(event.request));
    return;
  }

  // Next.js build assets and static files - Cache First strategy
  if (url.pathname.startsWith('/_next/') || url.pathname.includes('/public/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Network First strategy for other requests
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
