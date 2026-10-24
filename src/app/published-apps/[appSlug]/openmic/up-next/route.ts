import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { isPushConfigured } from "@/lib/notifications/push";
import { isHostToken, sendUpNext, showProjectFor } from "@/lib/openmic/push-server";

const UpNextSchema = z.object({
  /** A host's access token from the show's own Supabase project. */
  token: z.string().min(20),
  /** The lineup row the host just highlighted, as the sheet names it. */
  name: z.string().trim().min(1).max(120),
});

/**
 * The hosts' Remote tab, right after it moved the lineup spotlight: push "You're up next!" to the phones of the
 * comic now highlighted. Hosts only; the show's project decides who is a host.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = UpNextSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const project = await showProjectFor(published.app.id);
  if (!project) return Response.json({ error: "This app has no open mic sign-up" }, { status: 404 });
  if (!(await isHostToken(project, parsed.data.token))) return Response.json({ error: "Hosts only" }, { status: 403 });
  if (!isPushConfigured()) return Response.json({ error: "Push notifications are not set up on the server" }, { status: 503 });

  const result = await sendUpNext(published.app.id, parsed.data.name, project.showName);
  return Response.json(result);
}
