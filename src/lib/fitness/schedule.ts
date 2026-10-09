import type { FitnessClassType } from "@/types/database";

/**
 * FitnessNav's class types and the small date / time helpers its one-page schedule needs. Safe to import from client
 * and server code. Times are Seattle-local "HH:MM" strings, as the studios list them; dates are "YYYY-MM-DD".
 */
export interface ClassTypeDef {
  key: FitnessClassType;
  label: string;
}

export const CLASS_TYPES: ClassTypeDef[] = [
  { key: "pilates", label: "Pilates" },
  { key: "yoga", label: "Yoga" },
  { key: "spin", label: "Spin / Cycling" },
  { key: "lifting", label: "Weight lifting" },
  { key: "climbing", label: "Rock climbing" },
];

export const CLASS_TYPE_KEYS = CLASS_TYPES.map((t) => t.key) as [FitnessClassType, ...FitnessClassType[]];

export const CLASS_TYPE_LABEL: Record<FitnessClassType, string> = Object.fromEntries(
  CLASS_TYPES.map((t) => [t.key, t.label])
) as Record<FitnessClassType, string>;

/** One class as the published app shows it. */
export interface FitnessClass {
  id: string;
  studioId: string;
  date: string;
  start: string;
  end: string | null;
  name: string;
  instructor: string | null;
  spots: string | null;
  type: FitnessClassType | "other";
  online: boolean;
}

export interface FitnessStudio {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  bookUrl: string | null;
  website: string | null;
  readStatus: string | null;
  classCount: number;
  /** The neighborhood the studio is filed under (Ballard, Capitol Hill…); the page offers these as areas to look near. */
  neighborhood?: string | null;
}

export const SEATTLE_TZ = "America/Los_Angeles";

/** "YYYY-MM-DD HH:MM" for a moment, in Seattle time. */
export function seattleStamp(at: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: SEATTLE_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** Today's date in Seattle, "YYYY-MM-DD". */
export function seattleToday(at: Date = new Date()): string {
  return seattleStamp(at).slice(0, 10);
}

/** `count` consecutive dates starting at `from` ("YYYY-MM-DD"), safe across month ends and clock changes. */
export function nextDays(from: string, count = 7): string[] {
  const [y, m, d] = from.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

/** Whether a class has already started, given Seattle's "YYYY-MM-DD HH:MM" now. */
export function hasStarted(c: Pick<FitnessClass, "date" | "start">, now: string): boolean {
  return `${c.date} ${c.start}` < now;
}

export type PartOfDay = "Morning" | "Afternoon" | "Evening";

export function partOfDay(start: string): PartOfDay {
  return start < "12:00" ? "Morning" : start < "17:00" ? "Afternoon" : "Evening";
}

/** "18:30" → "6:30 PM". */
export function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Length in minutes, or null when there is no end time or it doesn't make sense. */
export function classMinutes(start: string, end: string | null): number | null {
  if (!end) return null;
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return d > 0 && d < 300 ? d : null;
}

/** The first day (of `days`) that still has a class to go to, so the page opens where there is something to book. */
export function firstDayWithClasses(days: string[], classes: Pick<FitnessClass, "date" | "start">[], now: string): string {
  return days.find((d) => classes.some((c) => c.date === d && !hasStarted(c, now))) ?? days[0];
}

/** Straight-line miles between two points. */
export function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(a));
}

/** An area a visitor can look near: a neighborhood, centred on its studios, with how many studios are there. */
export interface StudioArea {
  name: string;
  lat: number;
  lng: number;
  n: number;
}

/** The neighborhoods the studios are filed under, each at the middle of its own studios, A to Z. Studios without a place are left out. */
export function areasFromStudios(studios: Pick<FitnessStudio, "neighborhood" | "latitude" | "longitude">[]): StudioArea[] {
  const sums = new Map<string, { lat: number; lng: number; n: number }>();
  for (const s of studios) {
    if (!s.neighborhood || s.latitude == null || s.longitude == null) continue;
    const a = sums.get(s.neighborhood) ?? { lat: 0, lng: 0, n: 0 };
    sums.set(s.neighborhood, { lat: a.lat + s.latitude, lng: a.lng + s.longitude, n: a.n + 1 });
  }
  return [...sums].map(([name, a]) => ({ name, lat: a.lat / a.n, lng: a.lng / a.n, n: a.n })).sort((x, y) => x.name.localeCompare(y.name));
}

/** The area an app's own label stands for ("Fremont, Seattle" is the Fremont neighborhood), or null when no neighborhood starts the label. */
export function areaForLabel(areas: Pick<StudioArea, "name">[], label: string | null | undefined): string | null {
  const l = label?.trim().toLowerCase();
  if (!l) return null;
  // The longest name wins, so "Capitol Hill, Seattle" is not taken for a shorter "Capitol" area.
  const hit = areas.filter((a) => l.startsWith(a.name.toLowerCase())).sort((x, y) => y.name.length - x.name.length)[0];
  return hit?.name ?? null;
}
