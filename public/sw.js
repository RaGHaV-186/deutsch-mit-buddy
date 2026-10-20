/* Deutsch mit Buddy service worker.
 *
 * Keeps the Home and Cards screens (and the files they need) on the phone so Cards opens without a connection.
 * Card data itself lives in IndexedDB, not here. This worker never caches the API, login pages or anything else.
 * Bump VERSION to drop every cached file on the next visit. */

const VERSION = "v1";
const STATIC = "buddy-static-" + VERSION;
const PAGES = "buddy-pages-" + VERSION;
const APP_PAGES = ["/home", "/cards"];
const NETWORK_TIMEOUT_MS = 4000;
const MAX_STATIC_ENTRIES = 400;
const STATIC_URL = /\/_next\/static\/[^"'\\\s)<>]+/g;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("buddy-") && n !== STATIC && n !== PAGES).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Only complete, same-origin 200 responses are kept (never a redirect to the login page, never an error). */
function cacheable(res) {
  return res && res.status === 200 && !res.redirected && res.type === "basic";
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/buddy/") || pathname.startsWith("/icons/");
}

function offlineResponse() {
  const html =
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Offline</title>" +
    '<body style="font:18px system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;text-align:center">' +
    "<h1>Wuff! You're offline</h1>" +
    "<p>Open Deutsch mit Buddy once with a connection, and your cards will be ready here next time.</p></body></html>";
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) {
    cache.put(request, res.clone()).then(() => trim(cache), () => {});
  }
  return res;
}

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_STATIC_ENTRIES) return;
  // Oldest first: files from older deployments.
  await Promise.all(keys.slice(0, keys.length - MAX_STATIC_ENTRIES + 100).map((k) => cache.delete(k)));
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

/** Fresh page when the network answers quickly; the saved copy when it is down or slow; a short notice if neither. */
async function networkFirst(request, key) {
  const cache = await caches.open(PAGES);
  const saved = await cache.match(key);
  const network = fetch(request).then((res) => {
    if (cacheable(res)) cache.put(key, res.clone());
    return res;
  });
  if (!saved) return network.catch(() => offlineResponse());
  network.catch(() => {});
  return Promise.race([network, timeout(NETWORK_TIMEOUT_MS)]).catch(() => saved);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate" && APP_PAGES.includes(url.pathname)) {
    event.respondWith(networkFirst(request, url.pathname));
  }
  // Everything else (API calls, login, other pages, app-router data requests) goes straight to the network.
});

/**
 * The page asks us to save the app pages and the files they reference, because the very first visit happened
 * before this worker was in control and so was never cached.
 */
async function warm(pages, assets) {
  const pageCache = await caches.open(PAGES);
  const staticCache = await caches.open(STATIC);
  const wanted = new Set();

  for (const asset of assets) {
    try {
      const u = new URL(asset, self.location.origin);
      if (u.origin === self.location.origin && isStaticAsset(u.pathname)) wanted.add(u.pathname + u.search);
    } catch {
      /* ignore malformed entries */
    }
  }

  for (const path of pages) {
    if (!APP_PAGES.includes(path)) continue;
    try {
      const res = await fetch(path, { credentials: "same-origin", headers: { Accept: "text/html" } });
      if (!cacheable(res)) continue;
      await pageCache.put(path, res.clone());
      for (const match of (await res.text()).match(STATIC_URL) || []) wanted.add(match);
    } catch {
      /* offline: keep what we have */
    }
  }

  for (const asset of wanted) {
    try {
      if (await staticCache.match(asset)) continue;
      const res = await fetch(asset, { credentials: "same-origin" });
      if (cacheable(res)) await staticCache.put(asset, res);
    } catch {
      /* the next visit will try again */
    }
  }
  await trim(staticCache);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "warm" && Array.isArray(data.pages)) {
    event.waitUntil(warm(data.pages, Array.isArray(data.assets) ? data.assets : []));
  }
});
