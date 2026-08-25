const CACHE_VERSION = "oyano-moshimo-navi-v38";
const STATIC_CACHE_URLS = [
  "/offline",
  "/brand/watch-bird-mark.svg",
  "/brand/logo-mark.png",
  "/brand/apple-touch-icon.png",
  "/brand/pwa-icon-192.png",
  "/brand/favicon-32.png",
  "/brand/favicon-16.png",
  "/images/family-documents-hero.png",
  "/manifest.webmanifest"
];

// Crisis pages have to open on a hospital corridor at 2am, so they are fetched
// at install time instead of waiting for a first visit.
const PRECACHE_PAGE_URLS = [
  "/crisis",
  "/crisis/hospital-night",
  "/crisis/critical",
  "/crisis/just-died"
];

const PAGE_CACHE_URLS = new Set([
  "/",
  "/home",
  "/start",
  "/guides",
  "/checklists",
  "/safety",
  "/plans",
  ...PRECACHE_PAGE_URLS
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS).then(() =>
        Promise.all(PRECACHE_PAGE_URLS.map((url) => cache.add(url).catch(() => undefined)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/admin")) return;
  if (url.pathname.startsWith("/result/")) return;
  if (url.pathname.startsWith("/diagnosis")) return;

  if (url.searchParams.has("fresh") || url.searchParams.has("reset")) {
    event.respondWith(fetch(new Request(request, { cache: "reload" })));
    return;
  }

  if (STATIC_CACHE_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  if (request.mode === "navigate" || PAGE_CACHE_URLS.has(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) =>
          cached || caches.match("/offline").then((offline) => offline || caches.match("/home"))
        ))
    );
  }
});
