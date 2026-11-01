const CACHE_NAME = "ud-studio-v1";
const STATIC_ASSETS = [
  "/",
  "/convert",
  "/pdf-tools",
  "/generate",
  "/templates",
  "/history",
  "/settings",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  
  // Only cache GET requests
  if (request.method !== "GET") return;
  
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Don't cache non-200 responses or API requests
        if (!response.ok || response.status !== 200 || request.url.includes("/api/")) {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return response;
      }).catch(() => {
        // If offline and not cached, show offline page for HTML requests
        if (request.destination === "document") {
          return caches.match("/");
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      });
    })
  );
});
