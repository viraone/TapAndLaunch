// The show clock's three writes (hosts only; the database trigger refuses anyone else and stamps the times).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupEntry } from "@/lib/openmic/selection";
import type { SetRecord, Spotlight } from "@/lib/openmic/spotlight";

/** START: this comic's clock begins now (the trigger stamps set_at and clears stopped_at). Returns an error message or null. */
export async function startClock(client: SupabaseClient, showDate: string, lineup: LineupEntry[], index: number): Promise<string | null> {
  const entry = lineup[index];
  if (!entry) return "Nobody to start.";
  const { error } = await client.from("lineup_spotlight").update({ show_date: showDate, position: index, name: entry.name, stopped_at: null }).eq("id", 1);
  return error ? error.message : null;
}

/** STOP: the running clock ends now and the set is recorded (the trigger stamps stopped_at). */
export async function stopClock(client: SupabaseClient, spotlight: Spotlight): Promise<string | null> {
  if (spotlight.position === null) return "No clock is running.";
  const now = new Date().toISOString();
  const record: SetRecord = { position: spotlight.position, name: spotlight.name, started_at: spotlight.set_at, stopped_at: now };
  const { error } = await client.from("lineup_spotlight").update({ stopped_at: now, sets: [...(spotlight.sets ?? []), record] }).eq("id", 1);
  return error ? error.message : null;
}

/** RESET: the show is over (or never happened); the row goes back to nobody with no sets. */
export async function resetClock(client: SupabaseClient, showDate: string): Promise<string | null> {
  const { error } = await client.from("lineup_spotlight").update({ show_date: showDate, position: null, name: "", stopped_at: null, sets: [] }).eq("id", 1);
  return error ? error.message : null;
}
