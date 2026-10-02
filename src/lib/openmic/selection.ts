// What a comic sees on the show-day screen (Thu 10 PM → Fri 9:40 PM), from
// whether they're signed in, whether they requested this week, and the
// lineup feed the host's selections come from.

export interface LineupEntry {
  name: string;
  set_length: string;
  start_time: string;
}

export interface LineupFeed {
  show_date: string;
  /** The host has selected at least one comic. */
  posted: boolean;
  lineup: LineupEntry[];
  /** The signed-in comic's own status, matched by email; null if signed out. */
  me: { selected: boolean; set_length: string; start_time: string } | null;
}

export type ShowDayState =
  | "selected"
  | "not-selected"
  | "selections-pending"
  | "no-request"
  | "signed-out"
  | "unavailable";

export function showDayState(input: { signedIn: boolean; requested: boolean; feed: LineupFeed | null; failed: boolean }): ShowDayState {
  if (!input.signedIn) return "signed-out";
  if (!input.requested) return "no-request";
  if (input.failed && !input.feed) return "unavailable";
  if (input.feed?.me?.selected) return "selected";
  return input.feed?.posted ? "not-selected" : "selections-pending";
}

/** "tonight right after the show" on show day; on Thursday night the show is
 * tomorrow, so it says so. */
export function reopenPhrase(isShowDay: boolean): string {
  return isShowDay ? "tonight right after the show" : "right after tomorrow's show";
}

/** The approved message for someone who requested but wasn't selected. */
export function notSelectedCopy(isShowDay: boolean): { title: string; body: string } {
  return {
    title: "Thanks for requesting a spot!",
    body: `We got a lot of requests for this Friday's show and couldn't fit everyone in. You're not on for this week, but we'd love to see you try again. Requests open ${reopenPhrase(isShowDay)}.`,
  };
}

/** "7:00 PM · 5 min", leaving out whatever the host hasn't filled in. */
export function slotLine(entry: { start_time: string; set_length: string }): string {
  return [entry.start_time, entry.set_length].filter(Boolean).join(" · ");
}
