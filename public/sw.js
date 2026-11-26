/* Hisab service worker.
 *
 * - App shell (JS, CSS, fonts, icons, bank logos) is cache-first: those files
 *   are content-hashed or never change.
 * - Pages are network-first. Each page that loads successfully is saved, so
 *   anything opened before can be read again with no connection.
 * - Pages never opened fall back to /offline.
 * - Writes (POST: server actions, sign-in, sign-out) and /api/* always go to
 *   the network. Nothing is queued: balances are checked on the server, and a
 *   replayed expense could overdraw an account that changed meanwhile.
 *
 * Saved pages are wiped when the sign-in page is shown (see ClearOfflineCache).
 */
const VERSION = 'v3';
const STATIC_CACHE = `hisab-static-${VERSION}`;
const PAGE_CACHE = 'hisab-pages';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/manifest.json', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
const NETWORK_TIMEOUT_MS = 6000;
const MAX_PAGES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('hisab-static-') && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/logo/')
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') cache.put(request, response.clone());
  return response;
}

async function trimPages(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i]);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

async function networkFirstPage(event) {
  const { request } = event;
  const url = new URL(request.url);
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await withTimeout(fetch(request), NETWORK_TIMEOUT_MS));
    // Only keep real pages: not redirects to sign-in, not errors, not the
    // sign-in page itself.
    if (response.ok && !response.redirected && response.type === 'basic' && !url.pathname.startsWith('/login')) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
      trimPages(cache);
    }
    return response;
  } catch {
    const cache = await caches.open(PAGE_CACHE);
    const exact = await cache.match(request);
    if (exact) return exact;
    // /expenses?month=2026-10 offline → the last saved /expenses of any month.
    const loose = await cache.match(request, { ignoreSearch: true });
    if (loose) return loose;
    return (await caches.match(OFFLINE_URL)) || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Client-side navigations fetch RSC payloads; when they fail offline, Next
  // falls back to a full page load, which the navigate branch below serves.
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event));
  }
});
