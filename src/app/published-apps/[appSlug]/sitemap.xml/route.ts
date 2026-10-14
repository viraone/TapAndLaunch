import { headers } from "next/headers";
import { getPublishedApp } from "@/lib/pwa/data";

/** The app's pages, for search engines. Served at {the app's address}/sitemap.xml. */
export async function GET(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published || published.preview) return new Response("Not found", { status: 404 });
  const host = (await headers()).get("host") ?? "";
  const origin = `${/localhost|127\.0\.0\.1/.test(host) ? "http" : "https"}://${host}`;
  const urls = published.pages.map((p) => `${origin}${p.is_home ? "/" : `/${p.path}`}`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
