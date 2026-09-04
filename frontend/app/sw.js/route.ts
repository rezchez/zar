import { NextResponse } from 'next/server';
import { getServerAppSettings } from '@/lib/server-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getServerAppSettings();

  if (!settings.pwaEnabled || process.env.NODE_ENV !== 'production') {
    // Return self-destructing/unregistering service worker when PWA is disabled in backend or in development
    const disabledSw = `
// PWA is disabled by administrator in backend settings or running in development mode
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith('zarfolio-pwa') || name.includes('zarfolio-pwa-cache'))
          .map((name) => caches.delete(name))
      ))
      .then(() => self.registration.unregister())
  );
  self.clients.claim();
});
`;
    return new Response(disabledSw.trim(), {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  }

  // Active PWA Service Worker served dynamically from backend
  const activeSw = `
const CACHE_NAME = 'zarfolio-pwa-cache-v2';
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
  const isSensitive = SENSITIVE_ROUTES.some((route) => url.pathname.includes(route));

  if (isSensitive) {
    // Network only strategy for sensitive data
    event.respondWith(fetch(event.request));
    return;
  }

  // Next.js build assets & static files: Network First with cache fallback
  if (url.pathname.startsWith('/_next/') || url.pathname.includes('/public/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Network First strategy for other requests
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
`;

  return new Response(activeSw.trim(), {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
