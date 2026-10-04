import { getPublishedApp } from "@/lib/pwa/data";
import { buildServiceWorkerScript, deployId } from "@/lib/pwa/service-worker";

/**
 * Generates a per-tenant service worker (see lib/pwa/service-worker.ts): offline caching plus Web Push.
 * The text includes the deploy id, so each deploy is a new worker that browsers install and activate (a worker that
 * never changed meant phones kept old copies of the app).
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

  const script = buildServiceWorkerScript(appSlug, deployId());

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-store",
    },
  });
}
