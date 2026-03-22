const SW_VERSION = 'ecoroute-sw-v1';
const APP_SHELL_CACHE = `${SW_VERSION}-app-shell`;
const STATIC_CACHE = `${SW_VERSION}-static`;
const TILE_CACHE = 'eco-map-tiles-v1';
const API_CACHE = `${SW_VERSION}-api`;
const OFFLINE_TILE_PATH = '/offline-tile.svg';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  OFFLINE_TILE_PATH
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== APP_SHELL_CACHE && key !== STATIC_CACHE && key !== TILE_CACHE && key !== API_CACHE)
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (!isHttpRequest(url)) {
    return;
  }

  if (isTileRequest(url)) {
    event.respondWith(cacheFirst(request, TILE_CACHE, 2500));
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_SHELL_CACHE, '/index.html'));
    return;
  }

  if (['script', 'style', 'font', 'image', 'worker'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  event.respondWith(cacheFirst(request, STATIC_CACHE, 300));
});

function isTileRequest(url) {
  return url.hostname.includes('cartocdn.com') || url.hostname.includes('tile.openstreetmap.org');
}

function isHttpRequest(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isApiRequest(url) {
  return (
    url.pathname.includes('/api/route') ||
    url.hostname.includes('nominatim.openstreetmap.org')
  );
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && isCacheableRequest(request)) {
      await cache.put(request, response.clone());
      if (maxEntries) {
        await trimCache(cacheName, maxEntries);
      }
    }
    return response;
  } catch {
    if (cached) return cached;

    const requestUrl = new URL(request.url);
    if (isTileRequest(requestUrl)) {
      const appShell = await caches.open(APP_SHELL_CACHE);
      const fallbackTile = await appShell.match(OFFLINE_TILE_PATH);
      if (fallbackTile) return fallbackTile;
    }

    return Response.error();
  }
}

async function networkFirst(request, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok && isCacheableRequest(request)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (fallbackPath) {
      const appShell = await caches.open(APP_SHELL_CACHE);
      const fallback = await appShell.match(fallbackPath);
      if (fallback) return fallback;
    }

    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok && isCacheableRequest(request)) {
        try {
          await cache.put(request, response.clone());
        } catch {
        }
      }
      return response;
    })
    .catch(() => null);

  return cached || networkPromise || Response.error();
}

function isCacheableRequest(request) {
  try {
    const url = new URL(request.url);
    return isHttpRequest(url);
  } catch {
    return false;
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length <= maxEntries) return;

  const keysToDelete = keys.slice(0, keys.length - maxEntries);
  await Promise.all(keysToDelete.map((key) => cache.delete(key)));
}
