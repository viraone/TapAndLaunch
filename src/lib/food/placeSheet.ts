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

/**
 * The city from a Google formatted address ("1234 Broadway E, Seattle, WA 98102, USA" → "Seattle"):
 * the part before the "ST 12345" state part. Null if the address isn't in that shape.
 */
export function cityOf(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim());
  const stateAt = parts.findIndex((p) => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(p));
  return stateAt > 0 && parts[stateAt - 1] ? parts[stateAt - 1] : null;
}

/**
 * A Google search for "<name> <city> menu". Google shows the menu (or the restaurant's menu page)
 * right at the top. Free: a plain link, no API. Google's place data has no menu field to read.
 */
export function menuSearchUrl(name: string, address: string | null): string {
  const query = [name, cityOf(address), "menu"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
