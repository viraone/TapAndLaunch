import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { readLineupRemoved, type LineupRemoved } from "./removed";

/**
 * Where the lineup overlay lives: the blocks.config jsonb of the app's open_mic_signup block. The AI tab's block
 * (view "ai") is the one the AI route already reads, so it is preferred; the Sign-Up block and then the first
 * open_mic_signup block are fallbacks. Only the lineup_removed key is ever replaced.
 */

interface LineupBlock {
  id: string;
  config: OpenMicSignupBlockConfig;
}

async function lineupBlockFor(appId: string): Promise<LineupBlock | null> {
  const admin = createAdminClient();
  const { data: pages } = await admin.from("pages").select("id").eq("app_id", appId);
  const pageIds = (pages ?? []).map((page) => page.id);
  if (pageIds.length === 0) return null;
  const { data: blocks } = await admin
    .from("blocks")
    .select("id, config")
    .in("page_id", pageIds)
    .eq("type", "open_mic_signup");
  const rows = (blocks ?? []).map((block) => ({ id: block.id as string, config: block.config as OpenMicSignupBlockConfig }));
  const found =
    rows.find((row) => row.config.view === "ai") ??
    rows.find((row) => (row.config.view ?? "signup") === "signup") ??
    rows[0];
  return found ?? null;
}

/** The app's hidden names, or null when there is no block or no list yet. */
export async function readLineupRemovedForApp(appId: string): Promise<LineupRemoved | null> {
  const block = await lineupBlockFor(appId);
  return block ? readLineupRemoved(block.config.lineup_removed) : null;
}

/** Re-read the block's config, replace only lineup_removed, and write it back. Null when the save fails. */
export async function updateLineupRemoved(
  appId: string,
  update: (current: LineupRemoved | null) => LineupRemoved
): Promise<LineupRemoved | null> {
  const block = await lineupBlockFor(appId);
  if (!block) return null;
  const next = update(readLineupRemoved(block.config.lineup_removed));
  const { error } = await createAdminClient()
    .from("blocks")
    .update({ config: { ...block.config, lineup_removed: next } })
    .eq("id", block.id);
  return error ? null : next;
}
