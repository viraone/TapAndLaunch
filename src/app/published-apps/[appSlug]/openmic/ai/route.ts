import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { comicFromToken, isHostToken, showProjectFor } from "@/lib/openmic/push-server";
import {
  bareNameCommand,
  buildSystemPrompt,
  EDITS_NOT_LIVE,
  isRemovalCommand,
  isSpotlightCommand,
  matchComic,
  parseModelAnswer,
  previewCommand,
  removalReply,
  type LineupCommand,
} from "@/lib/openmic/ai-commands";
import { applyRemovals, readLineupRemoved } from "@/lib/openmic/removed";
import type { LineupFeed } from "@/lib/openmic/selection";
import { allowSearch } from "@/lib/domains/search-limit";
import { askDeepSeek } from "@/lib/ai/deepseek";
import type { OpenMicSignupBlockConfig } from "@/types/database";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(800),
});

const BodySchema = z.object({
  /** A host's access token from the show's own Supabase project. */
  token: z.string().min(20),
  messages: z.array(MessageSchema).min(1).max(12),
});

/** The app's AI block (open_mic_signup, view "ai"), read on the server so the lineup link stays out of the page. */
async function aiConfigFor(appId: string): Promise<OpenMicSignupBlockConfig | null> {
  const admin = createAdminClient();
  const { data: pages } = await admin.from("pages").select("id").eq("app_id", appId);
  const pageIds = (pages ?? []).map((p) => p.id);
  if (pageIds.length === 0) return null;
  const { data: blocks } = await admin.from("blocks").select("config").in("page_id", pageIds).eq("type", "open_mic_signup");
  const found = (blocks ?? []).map((b) => b.config as OpenMicSignupBlockConfig).find((c) => c.view === "ai");
  return found ?? null;
}

/** The lineup the model may see: names, set lengths and times only, never emails and never the viewer's row. */
async function readLineup(url: string | undefined): Promise<LineupFeed | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const feed = (await res.json()) as Partial<LineupFeed> | null;
    if (!feed || !Array.isArray(feed.lineup)) return null;
    return {
      show_date: typeof feed.show_date === "string" ? feed.show_date : "",
      posted: feed.posted === true,
      lineup: feed.lineup.map((entry) => ({
        name: typeof entry.name === "string" ? entry.name : "",
        set_length: typeof entry.set_length === "string" ? entry.set_length : "",
        start_time: typeof entry.start_time === "string" ? entry.start_time : "",
      })),
      // The model never needs the signed-in host's own row.
      me: null,
    };
  } catch {
    return null;
  }
}

/**
 * The hosts' AI tab: a chat about the lineup. Hosts only, and the model is never told about emails. remove,
 * no_show and back now change tonight's lineup right away (the client saves the overlay through
 * openmic/lineup-edit); every other accepted command still comes back as a sentence beginning "Would…", with
 * EDITS_NOT_LIVE saying where to make the change for now.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.messages[parsed.data.messages.length - 1]!.role !== "user") {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const project = await showProjectFor(published.app.id);
  if (!project) return Response.json({ error: "This app has no open mic sign-up" }, { status: 404 });
  const config = await aiConfigFor(published.app.id);
  if (!config) return Response.json({ error: "The AI isn't connected yet." }, { status: 404 });

  const token = parsed.data.token;
  const who = await comicFromToken(project, token);
  if (!who) return Response.json({ error: "Sign in again" }, { status: 401 });
  if (!(await isHostToken(project, token))) return Response.json({ error: "Not for you" }, { status: 403 });

  // Per host, in memory: enough to stop a loop of questions, not an accounting system.
  if (!allowSearch(who.email, Date.now(), 20)) {
    return Response.json({ error: "Slow down a little and try again." }, { status: 429 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Response.json({ error: "The AI isn't connected yet." }, { status: 503 });

  // The hosts' removals hide comics from the model as well as from the phones. A list for another show date is ignored.
  const stored = readLineupRemoved(config.lineup_removed);
  const raw = await readLineup(config.lineup_url);
  const removed = raw && stored && stored.show_date === raw.show_date ? stored : null;
  const feed = raw ? applyRemovals(raw, removed) : null;
  const system = feed
    ? buildSystemPrompt(feed.lineup, feed.show_date || null)
    : `${buildSystemPrompt([], null)}\n\nThe lineup could not be loaded just now.`;

  // A message that is only a comic's name is on_deck, read here so it is instant and cannot be misread.
  const lastText = parsed.data.messages[parsed.data.messages.length - 1]!.content;
  let reply = "";
  let command: LineupCommand | null = bareNameCommand(lastText, feed?.lineup ?? []);
  if (!command) {
    let answer: string;
    try {
      answer = await askDeepSeek({ system, turns: parsed.data.messages, apiKey });
    } catch (error) {
      console.error(`openmic/ai: ${error instanceof Error ? error.message : String(error)}`);
      return Response.json({ error: "The AI didn't answer. Try again." }, { status: 502 });
    }
    ({ reply, command } = parseModelAnswer(answer));
  }
  if (!command) return Response.json({ reply, command: null });

  // remove, no_show and back are live: they hide or restore a name in the overlay right away.
  if (isRemovalCommand(command)) {
    const removedRows = (removed?.names ?? []).map((name) => ({ name }));
    // remove/no_show also look at the removed names, so removing the same comic twice gives the same answer.
    const pool = command.type === "back" ? removedRows : [...(feed?.lineup ?? []), ...removedRows];
    const check = previewCommand(command, pool);
    if (!check.ok) return Response.json({ reply: check.text, command: null });
    const match = matchComic(command.name, pool);
    if (match.kind !== "one") return Response.json({ reply: check.text, command: null });
    return Response.json({ reply: removalReply(command, match.name), command: { ...command, name: match.name } });
  }

  const preview = previewCommand(command, feed?.lineup ?? []);
  if (!preview.ok) return Response.json({ reply: preview.text, command: null });
  // on_deck and performing are live on the hosts' phone, so they carry no "preview only" line.
  if (isSpotlightCommand(command)) return Response.json({ reply: preview.text, command });
  return Response.json({ reply: `${preview.text} ${EDITS_NOT_LIVE}`, command });
}
