// What the sign-up header says above the show date. On the show's own day (in the show's time zone) it reads
// "Tonight", with a countdown to the start until the show begins. Pure and clock-injected.

import { localDateOf, zonedTimeToUtc } from "@/lib/schedule/recurrence";

/** When the show starts, as wall-clock "HH:MM" in the show's time zone. */
export const SHOW_START_TIME = "19:00";

export type ShowHeading = { label: string; startsIn: string | null };

export function tonightHeading(showDate: { year: number; month: number; day: number }, timeZone: string, now: Date, startTime: string = SHOW_START_TIME): ShowHeading {
  const date = `${showDate.year}-${String(showDate.month).padStart(2, "0")}-${String(showDate.day).padStart(2, "0")}`;
  if (localDateOf(now, timeZone) !== date) return { label: "Next show", startsIn: null };
  const left = zonedTimeToUtc(date, startTime, timeZone).getTime() - now.getTime();
  if (left <= 0) return { label: "Tonight", startsIn: null };
  const minutes = Math.ceil(left / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { label: "Tonight", startsIn: h > 0 ? (m > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${h}h`) : `Starts in ${m}m` };
}
