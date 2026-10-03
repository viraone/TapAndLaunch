import { localWeekMinute } from "@/lib/food/hours";

export interface HoursRow {
  day: string;
  hours: string;
  today: boolean;
}

/**
 * Google's weekdayDescriptions ("Monday: 11 AM – 9 PM", Monday first) as rows for the place sheet,
 * with today's row flagged. "Today" is the restaurant's own local day (via its UTC offset), so a
 * viewer in another time zone still sees the right row.
 */
export function hoursRows(weekdayDescriptions: string[], now: Date, utcOffsetMinutes: number | null): HoursRow[] {
  // Sunday = 0 in localWeekMinute; Google lists Monday first.
  const todayIndex = utcOffsetMinutes === null ? -1 : (Math.floor(localWeekMinute(now, utcOffsetMinutes) / 1440) + 6) % 7;
  return weekdayDescriptions.map((line, i) => {
    const cut = line.indexOf(":");
    return {
      day: cut === -1 ? line : line.slice(0, cut),
      hours: cut === -1 ? "" : line.slice(cut + 1).trim(),
      today: i === todayIndex,
    };
  });
}
