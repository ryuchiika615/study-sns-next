const CACHE = "ryutter-v1";

// Assets to pre-cache on install
const PRECACHE = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install: pre-cache key pages, then skip waiting
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches, claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => clients.claim())
  );
});

// Helper: stale-while-revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((res) => {
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// Helper: network-first, fallback to cache
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}

// Helper: cache-first
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone());
  return res;
}

// Fetch: route requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== "GET") return;

  // API calls: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Next.js static assets (hashed filenames): cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Font Awesome CDN: cache-first
  if (url.hostname === "cdnjs.cloudflare.com") {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Images from storage: network-first
  if (url.hostname.endsWith("supabase.co") && url.pathname.includes("/storage/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (favicon, manifest, sw.js etc.): cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation (HTML pages): network-first
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Push notification handling (unchanged)
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const { title, body, icon, url } = data;

  event.waitUntil(
    self.registration.showNotification(title || "リュッター", {
      body: body || "",
      icon: icon || "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
