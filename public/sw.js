/* Deutsch mit Buddy service worker.
 *
 * Two jobs, nothing else:
 *  1. Static files (/_next/static, /buddy) are kept on the phone and served cache-first: they never change under the same name.
 *  2. The offline shell (/offline) is a public page with no account data. When an app screen cannot be reached, the worker sends the
 *     browser there, and it opens the Cards on this device from IndexedDB (card data lives there, not here).
 * It never stores an app screen (the HTML of /home, /cards ... holds the learner's data), the API, login pages or any user data.
 * Bump VERSION to drop every cached file on the next visit (older versions saved app screens; that cache is deleted on activate). */

const VERSION = "v3";
const STATIC = "buddy-static-" + VERSION;
const SHELL = "buddy-shell-" + VERSION;
const SHELL_PATH = "/offline";
const APP_SCREENS = ["/home", "/learn", "/cards", "/me", "/play"];
/** An app screen that has not answered after this long counts as unreachable (a bad connection is not better than none). */
const NETWORK_TIMEOUT_MS = 6000;
const MAX_STATIC_ENTRIES = 400;
const STATIC_URL = /\/_next\/static\/[^"'\\\s)<>]+/g;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("buddy-") && n !== STATIC && n !== SHELL).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/** Only complete, same-origin 200 responses are kept (never a redirect to the login page, never an error). */
function cacheable(res) {
  return res && res.status === 200 && !res.redirected && res.type === "basic";
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/buddy/");
}

function isAppScreen(pathname) {
  return APP_SCREENS.includes(pathname) || pathname.startsWith("/learn/");
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

/** An app screen always comes from the network (never from a saved copy); if the network does not answer, the offline shell takes over. */
async function screenOrShell(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } catch {
    return Response.redirect(new URL(SHELL_PATH, self.location.origin).href, 302);
  } finally {
    clearTimeout(timer);
  }
}

/** The shell is served from the phone at once and refreshed in the background, so it follows new deployments one visit later. */
async function shell(event) {
  const cache = await caches.open(SHELL);
  const saved = await cache.match(SHELL_PATH);
  const refresh = refreshShell([]);
  if (saved) {
    event.waitUntil(refresh);
    return saved;
  }
  try {
    await refresh;
    return (await cache.match(SHELL_PATH)) || offlineResponse();
  } catch {
    return offlineResponse();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate" && url.pathname === SHELL_PATH) {
    event.respondWith(shell(event));
  } else if (request.mode === "navigate" && isAppScreen(url.pathname)) {
    event.respondWith(screenOrShell(request));
  }
  // Everything else (API calls, login, other pages, app-router data requests) goes straight to the network.
});

/**
 * Saves the offline shell and the files it references (its own scripts and styles, plus the files the page reports), because the very
 * first visit happened before this worker was in control and so was never cached.
 */
async function refreshShell(assets) {
  const shellCache = await caches.open(SHELL);
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

  const res = await fetch(SHELL_PATH, { credentials: "same-origin", headers: { Accept: "text/html" } });
  if (cacheable(res)) {
    await shellCache.put(SHELL_PATH, res.clone());
    for (const match of (await res.text()).match(STATIC_URL) || []) wanted.add(match);
  }

  for (const asset of wanted) {
    try {
      if (await staticCache.match(asset)) continue;
      const file = await fetch(asset, { credentials: "same-origin" });
      if (cacheable(file)) await staticCache.put(asset, file);
    } catch {
      /* the next visit will try again */
    }
  }
  await trim(staticCache);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "warm") {
    event.waitUntil(refreshShell(Array.isArray(data.assets) ? data.assets : []).catch(() => {}));
  }
});
