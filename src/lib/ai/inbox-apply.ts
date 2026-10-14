import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyAgentOperations } from "@/lib/ai/agent";
import type { Extracted } from "@/lib/ai/inbox";
import { saveDraft, type Site } from "@/lib/ai/site-context";
import type { Database, ThemeConfig } from "@/types/database";

/** What a paste changed on the site, and everything needed to put it back. */
export interface InboxOutcome {
  summary: string;
  events: Array<{ id: string; title: string; starts_at: string; location: string | null }>;
  announcement: { before: ThemeConfig["announcement"] | null; after: string } | null;
  sections: Array<{ page: string; index: number }>;
  questions: string[];
  undo: { eventIds: string[]; theme: ThemeConfig | null; pages: Array<{ pageId: string; blocks: Site["draft"]["pages"][number]["blocks"] }> };
}

/** Saves what the model found, with the owner's own session. Partial failures are reported in `questions`. */
export async function applyExtraction(supabase: SupabaseClient<Database>, site: Site, found: Extracted): Promise<InboxOutcome> {
  const outcome: InboxOutcome = { summary: found.summary, events: [], announcement: null, sections: [], questions: [...found.questions], undo: { eventIds: [], theme: null, pages: [] } };

  for (const e of found.events) {
    const { data, error } = await supabase
      .from("events")
      .insert({ app_id: site.app.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, location: e.location, ticket_url: e.ticket_url, description: e.description })
      .select("id, title, starts_at, location")
      .single();
    if (error || !data) {
      outcome.questions.push(`Couldn't add "${e.title}": ${error?.message ?? "unknown error"}`);
      continue;
    }
    outcome.events.push(data);
    outcome.undo.eventIds.push(data.id);
  }

  const themeBefore = site.draft.theme;
  let theme = themeBefore;
  if (found.announcement) {
    theme = { ...themeBefore, announcement: { enabled: true, text: found.announcement.text, url: found.announcement.url ?? "" } };
    outcome.announcement = { before: themeBefore.announcement ?? null, after: found.announcement.text };
  }

  const before = { ...site.draft, theme: themeBefore };
  const { draft: after, applied, skipped } = applyAgentOperations({ ...site.draft, theme }, found.words.map((w) => ({ op: "set_words" as const, page: w.page, index: w.index, words: w.words })));
  for (const s of skipped) outcome.questions.push(s);
  if (applied > 0 || found.announcement) {
    for (const [i, page] of after.pages.entries()) {
      const old = before.pages[i];
      if (old?.id && JSON.stringify(old.blocks) !== JSON.stringify(page.blocks)) {
        outcome.undo.pages.push({ pageId: old.id, blocks: old.blocks });
        page.blocks.forEach((b, index) => {
          if (JSON.stringify(b) !== JSON.stringify(old.blocks[index])) outcome.sections.push({ page: page.name, index });
        });
      }
    }
    if (found.announcement) outcome.undo.theme = themeBefore;
    const error = await saveDraft(supabase, site.app.id, before, after);
    if (error) outcome.questions.push(`Couldn't save a change to the site: ${error}`);
  }
  return outcome;
}
