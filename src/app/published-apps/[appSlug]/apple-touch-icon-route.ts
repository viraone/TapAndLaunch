import { getPublishedApp } from "@/lib/pwa/data";

/** No uploaded icon, or one we couldn't fetch: the generated letter tile. */
const FALLBACK_ICON = "/app-icon?size=180";

/**
 * iOS asks for these two addresses on its own when a page has no
 * apple-touch-icon link (or Safari missed the one in the page head). We
 * proxy the uploaded icon from here rather than redirect to it: iOS 27
 * ignored the old cross-origin href + 302 + upstream no-cache setup and
 * showed a letter tile, so the bytes have to come from our own origin.
 * An unpublished app is a 404, like the sibling app-icon and
 * manifest.webmanifest routes; a missing or unreachable icon redirects to
 * the generated letter tile instead of failing.
 */
export async function appleTouchIconResponse(appSlug: string): Promise<Response> {
  const published = await getPublishedApp(appSlug);
  if (!published) return new Response("Not found", { status: 404 });

  const iconUrl = published.app.manifest.icon_url;
  if (!iconUrl) return fallbackRedirect();

  try {
    const upstream = await fetch(iconUrl);
    if (!upstream.ok) return fallbackRedirect();

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return fallbackRedirect();
  }
}

function fallbackRedirect(): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: FALLBACK_ICON },
  });
}
