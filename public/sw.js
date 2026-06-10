/*
 * EIAYN service worker (hand-rolled, no dependencies).
 *
 * - Navigations and /data/*.json snapshots: network-first so users get fresh
 *   data online, with the cached copy as the offline fallback. The footer's
 *   '마지막 업데이트' timestamp keeps a stale snapshot honest.
 * - Hashed build assets (/assets/), the icon and the manifest: cache-first,
 *   since their contents never change for a given URL.
 *
 * Bump CACHE_NAME to invalidate everything previously cached.
 */

const CACHE_NAME = 'eiayn-static-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Pre-cache the app shell so the very first offline visit still works.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add('./'))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheable(response) {
  // Only cache full, same-origin (type 'basic') 200 responses.
  return Boolean(response) && response.status === 200 && response.type === 'basic';
}

async function putInCache(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Storage failures (e.g. quota) must never break the response path.
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      await putInCache(request, response);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (isCacheable(response)) {
    await putInCache(request, response);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (
    request.mode === 'navigate' ||
    (url.pathname.includes('/data/') && url.pathname.endsWith('.json'))
  ) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('/icon.svg') ||
    url.pathname.endsWith('/manifest.webmanifest')
  ) {
    event.respondWith(cacheFirst(request));
  }
  // Anything else falls through to the browser's default handling.
});
