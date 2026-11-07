import { getPublishedApp } from "@/lib/pwa/data";
import { readLineupRemovedForApp } from "@/lib/openmic/removed-server";

/**
 * The names the hosts have taken off tonight's lineup, for every screen that shows it. Public, like the sheet the
 * lineup comes from: the list only hides rows from that read-only sheet. Never cached, because a host's AI tab can
 * change it while a phone is showing the lineup.
 */
export async function GET(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const removed = await readLineupRemovedForApp(published.app.id);
  return Response.json(removed ?? { show_date: "", names: [] }, { headers: { "Cache-Control": "no-store" } });
}
