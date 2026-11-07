import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { isHostToken, showProjectFor } from "@/lib/openmic/push-server";
import { nextRemoved } from "@/lib/openmic/removed";
import { updateLineupRemoved } from "@/lib/openmic/removed-server";

const LineupEditSchema = z.object({
  /** A host's access token from the show's own Supabase project. */
  token: z.string().min(20),
  action: z.enum(["remove", "restore"]),
  /** The comic's name as the lineup feed or the removed list gives it. */
  name: z.string().trim().min(1).max(100),
  /** The show date the overlay is for, as the lineup feed gives it. */
  show_date: z.string().trim().min(1).max(40),
});

/**
 * The hosts' AI tab: hide a comic from tonight's lineup (remove / no-show) or put one back. The sheet stays
 * read-only; the names are stored in the app's open_mic_signup block config and applied on every screen.
 * Hosts only; the show's project decides who is a host.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = LineupEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const project = await showProjectFor(published.app.id);
  if (!project) return Response.json({ error: "This app has no open mic sign-up" }, { status: 404 });
  if (!(await isHostToken(project, parsed.data.token))) return Response.json({ error: "Hosts only" }, { status: 403 });

  const removed = await updateLineupRemoved(published.app.id, (current) =>
    nextRemoved(current, parsed.data.show_date, parsed.data.action, parsed.data.name)
  );
  if (!removed) return Response.json({ error: "That did not save. Try again." }, { status: 500 });
  return Response.json({ ok: true, removed });
}
