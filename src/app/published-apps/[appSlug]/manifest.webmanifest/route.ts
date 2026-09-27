import { getPublishedApp } from "@/lib/pwa/data";

// Not using the built-in `manifest.ts` metadata file convention here: that
// convention is documented for the root of `app/`, and its params handling
// for a dynamic nested segment like `[appSlug]` isn't part of the
// documented contract. A plain Route Handler gives full control over the
// per-tenant manifest body and a guaranteed-correct 404 for an unpublished
// slug.
export async function GET(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);

  if (!published) {
    return new Response("Not found", { status: 404 });
  }

  const { manifest, name } = published.app;

  const body = {
    name: manifest.name ?? name,
    short_name: manifest.short_name ?? manifest.name ?? name,
    description: manifest.description,
    start_url: "/",
    scope: "/",
    display: manifest.display ?? "standalone",
    background_color: manifest.background_color ?? "#ffffff",
    theme_color: manifest.theme_color ?? "#ffffff",
    icons: manifest.icon_url
      ? [
          { src: manifest.icon_url, sizes: "192x192", type: "image/png" },
          { src: manifest.icon_url, sizes: "512x512", type: "image/png" },
        ]
      : [],
  };

  return Response.json(body, {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
}
