import { ImageResponse } from "next/og";
import { getPublishedApp } from "@/lib/pwa/data";
import { tileGradient, tileInitial } from "@/lib/apps/tile";

const SIZES = new Set([180, 192, 512]);

/**
 * The install icon for an app that has no uploaded icon: its dashboard
 * letter tile (same gradient, same initial) as a square PNG. Full-bleed
 * with the letter well inside the safe zone, so it also works as a
 * maskable icon on Android. `?size=` is 180 (Apple touch), 192 or 512.
 */
export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return new Response("Not found", { status: 404 });

  const requested = Number(new URL(request.url).searchParams.get("size"));
  const size = SIZES.has(requested) ? requested : 512;
  const { from, to } = tileGradient(published.app.id);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${from}, ${to})`,
          color: "white",
          fontSize: size * 0.46,
          fontWeight: 700,
        }}
      >
        {tileInitial(published.app.name)}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
