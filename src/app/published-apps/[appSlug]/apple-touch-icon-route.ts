import { getPublishedApp } from "@/lib/pwa/data";
import { appleTouchIconHref } from "@/lib/pwa/apple-touch-icon";

/**
 * iOS asks for these two addresses on its own when a page has no
 * apple-touch-icon link (or Safari missed the one in the page head). Both
 * route handlers answer with the same redirect; an unpublished app is a 404,
 * like the sibling app-icon and manifest.webmanifest routes.
 */
export async function appleTouchIconResponse(appSlug: string): Promise<Response> {
  const published = await getPublishedApp(appSlug);
  if (!published) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: { Location: appleTouchIconHref(published.app.manifest.icon_url) },
  });
}
