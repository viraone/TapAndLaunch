import { getPublishedApp } from "@/lib/pwa/data";

/**
 * Generates a per-tenant service worker. Phase 1 scope is offline caching
 * only (cache-first for static assets, network-first-with-cache-fallback
 * for navigations) — background sync and Web Push are schema-ready
 * (`analytics_events.event_type` already has `push_sent`/`push_opened`) but
 * intentionally not wired up here yet; see the README's phase notes.
 *
 * `no-store` on the response matters more than usual for a service worker
 * file: browsers already refuse to cache it past 24h, but an intermediary
 * cache serving a stale worker after a republish would be a confusing bug.
 */
export async function GET(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);

  if (!published) {
    return new Response("Not found", { status: 404 });
  }

  const cacheName = `beezer-app-${appSlug}-v1`;

  const script = `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isNavigation = event.request.mode === "navigate";

  if (isNavigation) {
    // Network-first for page navigations, falling back to the cached shell
    // when offline so the app still opens.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Cache-first for everything else (static assets, images).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

// TODO (later phase): "push" and "sync" event listeners for Web Push
// notifications (VAPID) and background sync go here once that phase lands.
`.trim();

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-store",
    },
  });
}
