import { getPublishedApp } from "@/lib/pwa/data";
import { recordAnalyticsEvent } from "@/lib/pwa/analytics";

/**
 * Called from the service worker's `notificationclick` handler (see
 * `sw.js/route.ts`) — a plain unauthenticated fetch, since the click can
 * happen with no page open and no member session to speak of.
 */
export async function POST(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await recordAnalyticsEvent({ appId: published.app.id, eventType: "push_opened" });
  return Response.json({ ok: true });
}
