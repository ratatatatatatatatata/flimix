/* FLIMIX service worker — minimal offline support.
 * Cache-first for the manifest + /icons/; network-first with cache fallback
 * for page navigations, ending in a tiny inline offline page. */

const CACHE = "flimix-v1";
const PRECACHE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FLIMIX — Оффлайн</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #07060a; color: #f2eefb; font-family: "Inter", "Segoe UI", system-ui, sans-serif; text-align: center; }
  main { padding: 2rem; }
  h1 { font-size: 1.35rem; margin: 0 0 0.6rem; }
  p { color: #a49bbd; font-size: 0.95rem; margin: 0 0 1.4rem; }
  button { background: linear-gradient(135deg, #6d3bff 0%, #8b5cf6 45%, #e06bf0 100%);
           color: #fff; border: 0; border-radius: 0.5rem; padding: 0.75rem 1.75rem;
           font-size: 0.95rem; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<main>
  <h1>Интернэт холболт тасалдсан байна</h1>
  <p>Холболтоо шалгаад дахин оролдоно уу.</p>
  <button onclick="location.reload()">Дахин ачаалах</button>
</main>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Cache-first: app icons + manifest.
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest")
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Network-first for navigations, falling back to cache, then offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (hit) =>
              hit ||
              new Response(OFFLINE_HTML, {
                status: 200,
                headers: { "Content-Type": "text/html; charset=utf-8" },
              }),
          ),
        ),
    );
  }
});
