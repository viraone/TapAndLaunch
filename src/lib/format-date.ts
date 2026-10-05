/**
 * Date and time text that comes out identical in Node and in every browser. `toLocaleString` with `dateStyle` and
 * `timeStyle` varies between engines ("Oct 7, 2026, 7:00 PM" in Node, "Oct 7, 2026 at 7:00 PM" in Safari), and newer
 * ICU versions put a narrow no-break space before AM/PM; either difference makes React report a hydration mismatch
 * when the server's text and the browser's first render disagree. So the pieces are formatted separately and joined here.
 */
const clean = (s: string) => s.replace(/[  ]/g, " ");

export function formatDay(date: Date, timeZone?: string): string {
  return clean(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }).format(date));
}

export function formatClock(date: Date, timeZone?: string): string {
  return clean(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(date));
}

/** "Oct 7, 2026 · 7:00 PM" */
export function formatDayTime(date: Date, timeZone?: string): string {
  return `${formatDay(date, timeZone)} · ${formatClock(date, timeZone)}`;
}

/** "Oct 7, 2026 · 7:00 PM – 9:00 PM", or with the end's date when it ends on another day. */
export function formatDayTimeRange(start: Date, end: Date | null, timeZone?: string): string {
  const startLabel = formatDayTime(start, timeZone);
  if (!end) return startLabel;
  const sameDay = formatDay(start, timeZone) === formatDay(end, timeZone);
  return `${startLabel} – ${sameDay ? formatClock(end, timeZone) : formatDayTime(end, timeZone)}`;
}
