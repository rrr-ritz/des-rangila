// Des Rangila Service Worker
// Provides offline support for the scanner PWA

const CACHE_NAME = "des-rangila-v1";
const STATIC_ASSETS = [
  "/",
  "/scan",
  "/me",
  "/booth",
  "/manifest.json",
];

// Install: precache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (let POST/PATCH etc go straight to network)
  if (event.request.method !== "GET") return;

  // API requests: network-first with 3s timeout
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      Promise.race([
        fetch(event.request)
          .then((response) => {
            // Cache successful GET API responses
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 3000)
        ),
      ]).catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cached) => {
          return cached || new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        });
      })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
