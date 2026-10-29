import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { comicFromToken, isHostToken, showProjectFor } from "@/lib/openmic/push-server";
import { isPublishedSheetUrl, mayReadVotes, parseTallyCsv, type VoteResults } from "@/lib/openmic/votes";
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

  const fresh = await readTally(config.votes_csv_url);
  if (fresh) {
    lastGood.set(appSlug, { results: fresh, at: new Date() });
    return Response.json({ results: fresh, fetched_at: new Date().toISOString() });
  }
  // Google's published copy answers oddly now and then (a 429, an HTML page, a timeout). On a show night the hosts
  // need a number more than a fresh one, so the last good tally from the past few minutes stands in, marked stale.
  const kept = lastGood.get(appSlug);
  if (kept && Date.now() - kept.at.getTime() < STALE_MS) {
    return Response.json({ results: kept.results, fetched_at: kept.at.toISOString(), stale: true });
  }
  return Response.json({ error: "The sheet didn't answer" }, { status: 502 });
}

/** The last tally that parsed, per app, so a hiccup at Google doesn't blank the hosts' screen. */
const lastGood = new Map<string, { results: VoteResults; at: Date }>();
const STALE_MS = 10 * 60_000;
const ATTEMPTS = 2;

/** The published CSV, parsed; null when Google didn't answer with a tally after a couple of tries. */
async function readTally(csvUrl: string): Promise<VoteResults | null> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      // A throwaway query value keeps an edge cache from handing back an old copy.
      const url = new URL(csvUrl);
      url.searchParams.set("t", String(Date.now()));
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        console.error(`vote-results: the sheet answered ${res.status} (try ${attempt})`);
        continue;
      }
      const text = await res.text();
      const results = parseTallyCsv(text);
      if (results) return results;
      console.error(`vote-results: the sheet isn't in the expected shape (try ${attempt}): ${text.slice(0, 120).replace(/\s+/g, " ")}`);
    } catch (error) {
      console.error(`vote-results: the sheet didn't answer (try ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}
