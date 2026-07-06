// sw.js — DailyNutritionDashboard
// GitHub Pages project site → scope is /DailyNutritionDashboard/
//
// HOW UPDATES ARE DETECTED (built into every browser, no extra code needed):
// The browser re-fetches THIS FILE on every navigation / at most every 24h,
// byte-for-byte compares it to the currently installed version, and if it
// differs, installs the new one as "waiting". That's why CACHE_VERSION below
// MUST change on every deploy — it's what makes this file's bytes differ.

const CACHE_VERSION = "2026-07-06-01"; // <-- bump this string every deploy
const CACHE_NAME = `csv-reader-shell-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./site.webmanifest",
  "./favicon.ico",
  "./AppIcon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  // Intentionally NOT calling self.skipWaiting() here.
  // We want this new worker to sit in "waiting" state until the user clicks
  // "Update" in the UI — that's what the snackbar/modal flow is for.
  // (Your old SW called skipWaiting() immediately, which is why updates were
  // silent/unpredictable, and also why a stale CACHE_NAME never got evicted —
  // activate ran before anyone could notice anything changed.)
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("csv-reader-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  event.waitUntil(self.clients.claim());
});

// Fired when the user clicks "Update" in the snackbar (see update-notifier.js)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Network-first: always try the network so users get fresh content
  // immediately; fall back to cache only when offline. Cache-first (your old
  // strategy) is what let stale script.js persist indefinitely.
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return networkResponse;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match("./index.html"))
      )
  );
});