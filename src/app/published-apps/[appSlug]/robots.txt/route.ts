import { headers } from "next/headers";
import { getPublishedApp } from "@/lib/pwa/data";
import { canonicalOrigin } from "@/lib/pwa/seo";

/** Search engines may read the app's pages; its own endpoints (forms, members, bookings) are not pages. */
export async function GET(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published || published.preview) return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
  const origin = canonicalOrigin(published.app, (await headers()).get("host"));
  const body = ["User-agent: *", "Allow: /", "Disallow: /members", "Disallow: /submit", "Disallow: /bookings", "Disallow: /orders", "Disallow: /newsletter", "Disallow: /push", "Disallow: /unsubscribe", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
