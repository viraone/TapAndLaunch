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

/** A tel: link from Google's international number ("+1 206-555-0100" → "tel:+12065550100"), or null. */
export function telHref(phoneInternational: string | null): string | null {
  if (!phoneInternational) return null;
  const digits = phoneInternational.replace(/[^\d+]/g, "");
  return /^\+\d{7,15}$/.test(digits) ? `tel:${digits}` : null;
}

/** The website only if it is a plain http(s) address (it comes from Google, but a link is a link). */
export function safeWebsite(website: string | null): string | null {
  if (!website) return null;
  try {
    const u = new URL(website);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The restaurant's full Google Maps page (phone, website, menu, photos, reviews). Free: a plain link, no API call. */
export function mapsPlaceUrl(name: string, googlePlaceId: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(googlePlaceId)}`;
}
