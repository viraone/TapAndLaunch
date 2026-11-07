/**
 * The hosts' removals on top of the read-only lineup sheet: a comic taken off tonight's lineup stays on the
 * sheet, so every screen hides the name through this overlay instead. Pure: no database and no network here.
 */

import type { LineupFeed } from "./selection";

/** The names hidden on one show date. Any other date is ignored, so an old list never hides tonight's comics. */
export interface LineupRemoved {
  show_date: string;
  names: string[];
}

/** Trimmed, single-spaced, lower-cased, so a name typed with odd case or spacing still matches. */
export function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The stored value from a block's config, or null when it is missing or not the shape this file expects. */
export function readLineupRemoved(value: unknown): LineupRemoved | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.show_date !== "string") return null;
  const names = Array.isArray(record.names)
    ? record.names.filter((name): name is string => typeof name === "string")
    : [];
  return { show_date: record.show_date, names };
}

/**
 * The feed with tonight's removed names filtered out. A removed comic's screen loses its own status too (the feed
 * marks that row with `mine`), so the page doesn't still say they're on. A list for another show date is ignored.
 */
export function applyRemovals(feed: LineupFeed, removed: LineupRemoved | null | undefined): LineupFeed {
  if (!removed || removed.show_date !== feed.show_date) return feed;
  const gone = new Set(removed.names.map(normalizeName));
  const lineup = feed.lineup.filter((entry) => !gone.has(normalizeName(entry.name)));
  const mineGone = feed.lineup.some((entry) => entry.mine === true && gone.has(normalizeName(entry.name)));
  return { ...feed, lineup, me: mineGone ? null : feed.me };
}

/** The list after one host edit. A different show date starts a fresh list; names are matched by normalizeName. */
export function nextRemoved(
  current: LineupRemoved | null | undefined,
  showDate: string,
  action: "remove" | "restore",
  name: string
): LineupRemoved {
  const base = current && current.show_date === showDate ? current.names : [];
  const trimmed = name.trim();
  const wanted = normalizeName(trimmed);
  if (action === "remove") {
    const already = base.some((entry) => normalizeName(entry) === wanted);
    return { show_date: showDate, names: already ? [...base] : [...base, trimmed] };
  }
  return { show_date: showDate, names: base.filter((entry) => normalizeName(entry) !== wanted) };
}
