import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { comicFromToken, isHostToken, showProjectFor } from "@/lib/openmic/push-server";
import { buildSystemPrompt, EDITS_NOT_LIVE, isSpotlightCommand, parseModelAnswer, previewCommand } from "@/lib/openmic/ai-commands";
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
async function readLineup(url: string | undefined): Promise<{ lineup: { name: string; set_length: string; start_time: string }[]; showDate: string | null } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const feed = (await res.json()) as LineupFeed;
    if (!feed || !Array.isArray(feed.lineup)) return null;
    return {
      showDate: typeof feed.show_date === "string" ? feed.show_date : null,
      lineup: feed.lineup.map((entry) => ({
        name: typeof entry.name === "string" ? entry.name : "",
        set_length: typeof entry.set_length === "string" ? entry.set_length : "",
        start_time: typeof entry.start_time === "string" ? entry.start_time : "",
      })),
    };
  } catch {
    return null;
  }
}

/**
 * The hosts' AI tab: a chat about the lineup, and previews of lineup changes. Hosts only. The model is never
 * told about emails, and this route changes nothing: every accepted command comes back as a sentence beginning
 * "Would…", with EDITS_NOT_LIVE saying where to make the change for now.
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

  const feed = await readLineup(config.lineup_url);
  const system = feed
    ? buildSystemPrompt(feed.lineup, feed.showDate)
    : `${buildSystemPrompt([], null)}\n\nThe lineup could not be loaded just now.`;

  let answer: string;
  try {
    answer = await askDeepSeek({ system, turns: parsed.data.messages, apiKey });
  } catch (error) {
    console.error(`openmic/ai: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "The AI didn't answer. Try again." }, { status: 502 });
  }

  const { reply, command } = parseModelAnswer(answer);
  if (!command) return Response.json({ reply, command: null });

  const preview = previewCommand(command, feed?.lineup ?? []);
  if (!preview.ok) return Response.json({ reply: preview.text, command: null });
  // on_deck and performing are live on the hosts' phone, so they carry no "preview only" line.
  if (isSpotlightCommand(command)) return Response.json({ reply: preview.text, command });
  return Response.json({ reply: `${preview.text} ${EDITS_NOT_LIVE}`, command });
}
