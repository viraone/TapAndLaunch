import { NOTIFICATION_CLICK_HANDLER } from "@/lib/pwa/notification-click";

/**
 * Which deploy this is. It goes into the service worker's text, so every deploy produces a different worker file:
 * browsers only install a new service worker when the file's bytes change, and a worker that is identical across deploys
 * (as it used to be, with a fixed "v1" cache name) is never updated, which left phones on old copies of the app.
 */
export function deployId(env: Record<string, string | undefined> = process.env): string {
  return (env.VERCEL_GIT_COMMIT_SHA ?? env.VERCEL_DEPLOYMENT_ID ?? "dev").slice(0, 12);
}

/**
 * The per-app service worker: offline support plus Web Push.
 * - Pages: network first (the newest version whenever there is a connection), the cached shell when offline.
 * - /_next/static/ files: cache first. Their names contain a hash of their content, so a cached one can never be stale.
 * - Everything else (images, manifest, data): network first, cached copy when offline, so a replaced file shows up.
 * - A new deploy gets a new cache name; the old caches are deleted when the new worker activates.
 */
export function buildServiceWorkerScript(appSlug: string, deploy: string): string {
  const cacheName = `beezer-app-${appSlug}-${deploy}`;
  return `
// deploy ${deploy}
const CACHE_NAME = ${JSON.stringify(cacheName)};
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function networkFirst(request, fallback) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || (fallback ? caches.match(fallback) : undefined)));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, OFFLINE_URL));
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(networkFirst(event.request));
});

self.addEventListener("push", (event) => {
  let data = { title: "New notification", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload (shouldn't happen -- every sender in this repo sends
    // JSON) -- fall back to the default title/body rather than throwing and
    // dropping the notification entirely.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url || "/" },
    })
  );
});

${NOTIFICATION_CLICK_HANDLER}

// TODO (later phase): a "sync" event listener for background sync (e.g.
// retrying a queued offline form submission) -- unrelated to push, and not
// part of this phase's scope.
`.trim();
}
