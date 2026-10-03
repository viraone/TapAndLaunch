import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { orgHasMaps } from "@/lib/platform/maps";
import { MAPS_LOCKED_MESSAGE } from "@/lib/platform/maps-shared";
import { getMenuInfo } from "@/lib/food/menuLookup";

const MenuSchema = z.object({ placeId: z.string().uuid() });

/**
 * Where a restaurant's menu can be shown inside the app: its own website's menu page, when that site allows
 * being shown in another page. Remembered for 30 days (lib/food/menuLookup.ts). Costs nothing: it's our
 * server looking at the restaurant's site, not a Google call. Always answers; "not embeddable" is a normal result.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await orgHasMaps(published.app.organization_id))) {
    return Response.json({ error: MAPS_LOCKED_MESSAGE }, { status: 403 });
  }

  const parsed = MenuSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  return Response.json(await getMenuInfo(published.app.id, parsed.data.placeId));
}
