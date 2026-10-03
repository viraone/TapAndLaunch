import { getPublishedApp } from "@/lib/pwa/data";
import { NOTIFICATION_CLICK_HANDLER } from "@/lib/pwa/notification-click";

/**
 * Generates a per-tenant service worker: offline caching (cache-first for
 * static assets, network-first-with-cache-fallback for navigations, from
 * Phase 1) plus Web Push (Phase 4) — a `push` handler that displays the
 * notification and a `notificationclick` handler that focuses/opens the
 * target URL and records `push_opened`. Background sync is still not
 * wired up; see the README's phase notes.
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

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-store",
    },
  });
}
