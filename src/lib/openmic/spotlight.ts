// The lineup spotlight: the comic the hosts have highlighted on the show-night board from the Remote tab.
// One row in the show's database (rickshaw-open-mic `lineup_spotlight`, slotted-killer migration
// 20261021000000): the show date, a position in the lineup and the name that was there when the host picked
// it. The board, the remote and each comic's phone follow it over realtime. The pure parts are here so they
// can be tested without a browser.

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupEntry } from "@/lib/openmic/selection";

export interface Spotlight {
  /** YYYY-MM-DD of the show it was set for, or null when it has never been set. */
  show_date: string | null;
  /** 0 = first in the lineup; null = nobody is highlighted. */
  position: number | null;
  /** The name at that position when the host picked it, so the highlight follows a comic if rows move. */
  name: string;
  set_at: string;
  set_by: string;
}

/** YYYY-MM-DD from a show date's parts. */
export function ymd(date: { year: number; month: number; day: number }): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/** Which row of the lineup the spotlight is on: the row at its position if the name still matches, else the
 * first row with that name (the host moved rows in the sheet), else -1. A spotlight for another show day, or
 * with nobody picked, is -1. */
export function spotlightIndex(spotlight: Spotlight | null, lineup: LineupEntry[], showDate: string): number {
  if (!spotlight || spotlight.position === null || spotlight.show_date !== showDate) return -1;
  const at = lineup[spotlight.position];
  if (at && at.name === spotlight.name) return spotlight.position;
  const byName = lineup.findIndex((e) => e.name === spotlight.name);
  if (byName !== -1) return byName;
  // The name is gone from the sheet but the position still exists: keep the position (a renamed row).
  return at && !spotlight.name ? spotlight.position : -1;
}

/** The spotlight, kept current over realtime (and re-read every half minute in case the connection drops). */
export function useSpotlight(client: SupabaseClient | null): { spotlight: Spotlight | null; failed: boolean } {
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await client.from("lineup_spotlight").select("show_date, position, name, set_at, set_by").eq("id", 1).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setFailed(true);
        return;
      }
      setSpotlight(data as Spotlight);
      setFailed(false);
    };
    void load();
    const channel = client
      .channel("lineup_spotlight")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lineup_spotlight" }, (payload) => {
        if (!cancelled) setSpotlight(payload.new as Spotlight);
      })
      .subscribe();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [client]);
  return { spotlight, failed };
}

/** Move the spotlight (hosts only; the database refuses anyone else). `index` -1 clears it. */
export async function setSpotlight(client: SupabaseClient, showDate: string, lineup: LineupEntry[], index: number): Promise<string | null> {
  const entry = index >= 0 ? lineup[index] : undefined;
  const { error } = await client
    .from("lineup_spotlight")
    .update({ show_date: showDate, position: entry ? index : null, name: entry?.name ?? "" })
    .eq("id", 1);
  return error ? error.message : null;
}
