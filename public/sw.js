// Nexuspay PWA Service Worker for Offline Intake Mode
const CACHE_NAME = "nexuspay-companion-v1";
const OFFLINE_URLS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/robots.txt"
];

// Install Event: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn("PWA pre-cache error:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: purge stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first with cache fallback for offline resilience
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip external supabase API calls from SW cache to avoid auth staleness
  if (url.hostname.includes("supabase.co") || url.hostname.includes("lovable.cloud")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache valid static responses
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === "navigate") {
          return caches.match("/");
        }
        return new Response("Offline mode active - connection needed for live sync", {
          status: 503,
          statusText: "Service Unavailable (Offline)",
          headers: new Headers({ "Content-Type": "text/plain" }),
        });
      })
  );
});
