const CACHE_PREFIX = "atmo-web-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_BASE = new URL("./", self.registration.scope).pathname;
const APP_SHELL = APP_BASE;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(APP_SHELL, { cache: "reload" });
    if (!response.ok) throw new Error("ATMO app shell could not be cached");
    await cache.put(APP_SHELL, response.clone());

    const html = await response.text();
    const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((path) => path.startsWith(APP_BASE) && !path.startsWith("//"));

    await Promise.all(assetPaths.map(async (path) => {
      try {
        const assetResponse = await fetch(path, { cache: "reload" });
        if (assetResponse.ok) await cache.put(path, assetResponse);
      } catch {
        // A single optional asset must not prevent the app from being installed.
      }
    }));

    try {
      const manifestResponse = await fetch(`${APP_BASE}manifest.webmanifest`, { cache: "reload" });
      if (manifestResponse.ok) await cache.put(`${APP_BASE}manifest.webmanifest`, manifestResponse);
    } catch {
      // The manifest can be fetched again when the network is available.
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname.startsWith(APP_BASE)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_SHELL, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(APP_SHELL)) ||
          new Response("ATMO çevrimdışı. İnternet bağlantınızı kontrol edip tekrar deneyin.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
      }
    })());
    return;
  }

  const isStaticAsset =
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.startsWith(`${APP_BASE}assets/`);

  if (!isStaticAsset || !url.pathname.startsWith(APP_BASE)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
