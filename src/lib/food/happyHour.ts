import type { HappyHourWindow } from "@/types/database";
import { WEEK_MINUTES, formatClock, localWeekMinute } from "@/lib/food/hours";

/**
 * Live happy hour status from the windows a restaurant's website states, evaluated in the *place's* local time
 * (same week-minute model as hours.ts) so "Until 6 PM" stays honest between fetches. Pure and client-safe.
 * A window that ends after midnight (10 PM to 1 AM) belongs to the day it starts on.
 */

export type HappyHourStatus =
  | { state: "active"; endsInMinutes: number | null; endsAtLabel: string | null; deal: string | null }
  | { state: "later"; startsInMinutes: number; startsAtLabel: string; deal: string | null }
  | { state: "none" };

/** What the place's own opening hours say about closing, for windows that run "until close"; null when it isn't open now. */
export type CloseInfo = { closesInMinutes: number | null; closesAtLabel: string | null } | null;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "16:00" → 960; anything else → null. */
export function clockToMinutes(hhmm: unknown): number | null {
  const m = typeof hhmm === "string" ? /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim()) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Windows as stored (jsonb), keeping only well-formed ones. */
export function parseHappyHour(raw: unknown): HappyHourWindow[] {
  const list = (raw as { windows?: unknown } | null)?.windows;
  if (!Array.isArray(list)) return [];
  const out: HappyHourWindow[] = [];
  for (const w of list) {
    if (!w || typeof w !== "object") continue;
    const { days, start, end, deal } = w as Record<string, unknown>;
    const dayList = Array.isArray(days) ? [...new Set(days.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))] : [];
    const s = clockToMinutes(start);
    const e = end === null || end === undefined ? null : clockToMinutes(end);
    if (dayList.length === 0 || s === null || (end !== null && end !== undefined && e === null) || e === s) continue;
    out.push({
      days: dayList.sort((a, b) => a - b),
      start: start as string,
      end: e === null ? null : (end as string),
      deal: typeof deal === "string" && deal.trim() ? deal.trim().slice(0, 140) : null,
    });
  }
  return out;
}

export function computeHappyHour(
  windows: HappyHourWindow[] | null | undefined,
  utcOffsetMinutes: number | null | undefined,
  now: Date = new Date(),
  closeInfo: CloseInfo = null
): HappyHourStatus {
  if (!windows || windows.length === 0 || utcOffsetMinutes === null || utcOffsetMinutes === undefined) return { state: "none" };
  const nowW = localWeekMinute(now, utcOffsetMinutes);
  const dayStart = Math.floor(nowW / 1440) * 1440;
  const nextMidnight = dayStart + 1440;

  let active: Extract<HappyHourStatus, { state: "active" }> | null = null;
  let later: Extract<HappyHourStatus, { state: "later" }> | null = null;

  for (const w of windows) {
    const s = clockToMinutes(w.start);
    const e = w.end === null ? null : clockToMinutes(w.end);
    if (s === null || (w.end !== null && e === null)) continue;
    // "Until close" ends with the place's own hours; a closed place isn't running one.
    const length = e === null ? null : e > s ? e - s : e - s + 1440;
    for (const day of w.days) {
      for (const shift of [-WEEK_MINUTES, 0, WEEK_MINUTES]) {
        const start = day * 1440 + s + shift;
        if (length === null) {
          if (nowW >= start && nowW < start + 1440 && closeInfo) {
            const endsIn = closeInfo.closesInMinutes;
            if (!active || (endsIn ?? Infinity) < (active.endsInMinutes ?? Infinity)) {
              active = { state: "active", endsInMinutes: endsIn, endsAtLabel: closeInfo.closesAtLabel, deal: w.deal };
            }
          }
        } else if (nowW >= start && nowW < start + length) {
          const endsIn = start + length - nowW;
          if (!active || endsIn < (active.endsInMinutes ?? Infinity)) {
            active = { state: "active", endsInMinutes: endsIn, endsAtLabel: formatClock(start + length), deal: w.deal };
          }
        }
        if (start > nowW && start < nextMidnight && (!later || start - nowW < later.startsInMinutes)) {
          later = { state: "later", startsInMinutes: start - nowW, startsAtLabel: formatClock(start), deal: w.deal };
        }
      }
    }
  }
  return active ?? later ?? { state: "none" };
}

/** "Mon–Fri", "Mon, Wed, Fri", "Every day". */
export function daysLabel(days: number[]): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 7) return "Every day";
  if (d.length === 1) return DAY_SHORT[d[0]];
  const consecutive = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  if (consecutive && d.length >= 3) return `${DAY_SHORT[d[0]]}–${DAY_SHORT[d[d.length - 1]]}`;
  return d.map((x) => DAY_SHORT[x]).join(", ");
}

/** "4 PM – 6 PM" / "4 PM – close". */
export function windowTimeLabel(w: HappyHourWindow): string {
  const s = clockToMinutes(w.start);
  const e = w.end === null ? null : clockToMinutes(w.end);
  return `${s === null ? w.start : formatClock(s)} – ${e === null ? "close" : formatClock(e)}`;
}

/** A happy hour nobody has re-confirmed from the restaurant's website for this long is hidden rather than risk sending someone to one that ended. */
export const HAPPY_HOUR_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

/** Stored windows for a place, or none when they were last confirmed too long ago (or never dated). */
export function happyHourFor(raw: unknown, checkedAt: string | null | undefined, now: number = Date.now()): HappyHourWindow[] {
  if (!checkedAt) return [];
  const at = new Date(checkedAt).getTime();
  if (!Number.isFinite(at) || now - at > HAPPY_HOUR_MAX_AGE_MS) return [];
  return parseHappyHour(raw);
}
