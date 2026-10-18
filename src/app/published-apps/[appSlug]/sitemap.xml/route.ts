import { headers } from "next/headers";
import { getPublishedApp } from "@/lib/pwa/data";
import { canonicalOrigin, pagePath } from "@/lib/pwa/seo";

/** The app's pages at their one address each (the connected domain, when there is one), for search engines. Served at {the app's address}/sitemap.xml. */
export async function GET(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published || published.preview) return new Response("Not found", { status: 404 });
  const origin = canonicalOrigin(published.app, (await headers()).get("host"));
  const urls = published.pages.map((p) => `${origin}${pagePath(p)}`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
