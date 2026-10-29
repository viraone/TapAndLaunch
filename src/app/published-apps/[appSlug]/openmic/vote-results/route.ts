import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { comicFromToken, isHostToken, showProjectFor } from "@/lib/openmic/push-server";
import { isPublishedSheetUrl, mayReadVotes, parseTallyCsv } from "@/lib/openmic/votes";
import type { OpenMicSignupBlockConfig } from "@/types/database";

const BodySchema = z.object({
  /** A host's access token from the show's own Supabase project. */
  token: z.string().min(20),
});

/** The app's Votes block (open_mic_signup, view "votes"), read on the server so the sheet link stays out of the page. */
async function votesConfigFor(appId: string): Promise<OpenMicSignupBlockConfig | null> {
  const admin = createAdminClient();
  const { data: pages } = await admin.from("pages").select("id").eq("app_id", appId);
  const pageIds = (pages ?? []).map((p) => p.id);
  if (pageIds.length === 0) return null;
  const { data: blocks } = await admin.from("blocks").select("config").in("page_id", pageIds).eq("type", "open_mic_signup");
  const found = (blocks ?? []).map((b) => b.config as OpenMicSignupBlockConfig).find((c) => c.view === "votes");
  return found ?? null;
}

/**
 * The hosts' Votes tab: the costume contest's tally, read from the published "Tally" tab of the host's Google
 * Sheet. Hosts only, and only the people listed in the block's `results_emails` when it has any.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const project = await showProjectFor(published.app.id);
  if (!project) return Response.json({ error: "This app has no open mic sign-up" }, { status: 404 });
  const config = await votesConfigFor(published.app.id);
  if (!config?.votes_csv_url || !isPublishedSheetUrl(config.votes_csv_url)) return Response.json({ error: "The vote tally isn't connected" }, { status: 404 });

  const who = await comicFromToken(project, parsed.data.token);
  if (!who) return Response.json({ error: "Sign in again" }, { status: 401 });
  if (!(await isHostToken(project, parsed.data.token)) || !mayReadVotes(who.email, config.results_emails)) {
    return Response.json({ error: "Not for you" }, { status: 403 });
  }

  try {
    // A throwaway query value keeps an edge cache from handing back an old copy.
    const url = new URL(config.votes_csv_url);
    url.searchParams.set("t", String(Date.now()));
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return Response.json({ error: "The sheet didn't answer" }, { status: 502 });
    const results = parseTallyCsv(await res.text());
    if (!results) return Response.json({ error: "The sheet isn't in the expected shape" }, { status: 502 });
    return Response.json({ results, fetched_at: new Date().toISOString() });
  } catch {
    return Response.json({ error: "The sheet didn't answer" }, { status: 502 });
  }
}
