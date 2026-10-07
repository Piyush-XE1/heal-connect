/**
 * Heal Connect service worker.
 *
 * Caching model
 *  - App shell (marketing + auth entry pages) is precached so the app opens instantly
 *    and shows something useful offline.
 *  - Navigations are network-first with a short timeout; on failure we fall back to a
 *    cached copy of the same route, then to a cached authenticated shell, then to
 *    /offline.html. This keeps authenticated routes usable after the first visit.
 *  - Static build assets and icons are stale-while-revalidate; fonts are cache-first.
 *  - API/server-function calls are never cached (always network) because medical request
 *    data must be fresh and must never leak between sessions on a shared device.
 *  - While running on a development host (localhost or a preview domain) caching is
 *    disabled so hot reload stays correct; the worker still provides the offline page
 *    and the push scaffolding.
 */

const VERSION = "heal-connect-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const FONT_CACHE = `${VERSION}-fonts`;
const PAGE_CACHE = `${VERSION}-pages`;

const OFFLINE_URL = "/offline.html";

/*
 * Keep the install step lean. Every extra URL here is a request fired at the
 * same moment the user is waiting for the page, so we precache only the offline
 * fallback, the manifest and the icons the OS needs. Public routes are cached
 * on first visit instead (see handleNavigation).
 */
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const DEV_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$|\.e2b\.app$/i.test(
  self.location.hostname,
);
const DEV_PATH = /^\/(@|src\/|node_modules\/|__vite|__tsr|assets\/.*\?t=)/;

const isStaticAsset = (url) =>
  /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico|webmanifest)$/i.test(
    url.pathname,
  );

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individual adds: one failing URL must not abort the whole install.
      await Promise.all(
        PRECACHE.map(async (path) => {
          try {
            const response = await fetch(new Request(path, { cache: "reload" }));
            if (response.ok && response.type === "basic") await cache.put(path, response);
          } catch {
            /* offline at install time — fine */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch {
          /* not supported */
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "SKIP_WAITING") void self.skipWaiting();
  if (data.type === "CLEAR_CACHES") {
    void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
  }
});

/** Network-first for documents, with a cached fallback chain. */
async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  if (!DEV_HOST) {
    try {
      const preload = await request.preloadResponse;
      if (preload) return preload;
    } catch {
      /* ignore */
    }
  }

  try {
    const response = await fetchWithTimeout(request, 3500);
    if (response && response.ok && !DEV_HOST) {
      // Only cache committed documents from the same origin.
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        cache
          .put(request, response.clone())
          .then(trimPageCache)
          .catch(() => {});
      }
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request, { ignoreSearch: false })) ?? (await cache.match(request));
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    const offline = (await shell.match(OFFLINE_URL)) ?? (await caches.match(OFFLINE_URL));
    if (offline) return offline;
    return new Response(
      '<!doctype html><meta charset=utf-8><title>Offline</title><body style="font-family:system-ui;padding:2rem"><h1>You are offline</h1><p>Reconnect to load Heal Connect.</p></body>',
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
}

/** Keeps the page cache from growing without bound on long-lived installs. */
async function trimPageCache() {
  try {
    const cache = await caches.open(PAGE_CACHE);
    const keys = await cache.keys();
    if (keys.length <= 24) return;
    await Promise.all(keys.slice(0, keys.length - 24).map((key) => cache.delete(key)));
  } catch {
    /* non-fatal */
  }
}

async function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build assets are content-hashed and immutable, so a cache hit is always
 * correct — serving it straight from cache avoids a pointless network request
 * on every page view. Anything else (icons, manifest, arbitrary static files)
 * is stale-while-revalidate.
 */
async function handleAsset(request, immutable) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached && immutable) return cached;
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && !DEV_HOST)
        cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => undefined);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  return new Response("", { status: 504, statusText: "Offline" });
}

/** Cache-first for webfont files. */
async function handleFont(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return cached ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin !== self.location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname))
      event.respondWith(handleFont(request));
    return;
  }

  if (DEV_PATH.test(url.pathname)) return;

  // Never cache session, API or server-function traffic.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_server")) return;

  if (url.pathname.startsWith("/icons/") || isStaticAsset(url)) {
    event.respondWith(handleAsset(request, url.pathname.startsWith("/assets/")));
  }
});

/* ------------------------------------------------------------------ *
 * Push notification scaffolding.
 * The notification pipeline already fans out in-app notifications from the
 * server (new matching requests, donor responses, request updates, verification
 * decisions). When a push provider is added, POST the same payload to this
 * worker; no client changes are needed.
 * ------------------------------------------------------------------ */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Heal Connect", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Heal Connect";
  const options = {
    body: payload.body || "You have a new update.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    tag: payload.tag || "heal-connect",
    renotify: false,
    data: { url: payload.url || "/notifications" },
    actions: [{ action: "open", title: "Open Heal Connect" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin)
    .href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      const existing = all.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing && "navigate" in existing) {
        await existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
