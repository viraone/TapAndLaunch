import { ImageResponse } from "next/og";
import { getPublishedApp } from "@/lib/pwa/data";
import { tileGradient, tileInitial } from "@/lib/apps/tile";
import { pageTitle } from "@/lib/pwa/page-title";

/**
 * The picture a link to a page shows in a message or a feed, for a page that has no share picture of its own: the
 * app's letter tile and name over its tile gradient, with the page's title (or the app's tagline on the home page).
 * `?page=<path>` picks the page; without it, the home page. 1200 by 630, what every network expects.
 */
export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return new Response("Not found", { status: 404 });

  const { app } = published;
  const pagePath = new URL(request.url).searchParams.get("page");
  const page = pagePath ? published.pages.find((p) => p.path === pagePath && !p.is_home) : undefined;
  const name = app.manifest.name?.trim() || app.name;
  const line = page ? pageTitle(app, page).replace(new RegExp(` · ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "") : app.theme.header_tagline?.trim() || app.manifest.description?.trim() || "";
  const { from, to } = tileGradient(app.id);
  const icon = app.manifest.icon_url?.trim();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "white",
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- drawn into the picture, not a page
            <img src={icon} alt="" width={88} height={88} style={{ borderRadius: 24, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 88, height: 88, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 700, background: "rgba(255,255,255,0.22)" }}>
              {tileInitial(app.name)}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>{name}</div>
        </div>
        {line && <div style={{ display: "flex", fontSize: line.length > 60 ? 48 : 72, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>{line.length > 120 ? `${line.slice(0, 117)}…` : line}</div>}
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
