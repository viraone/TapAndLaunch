import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLASS_TYPE_KEYS, nextDays, type FitnessClass, type FitnessStudio } from "@/lib/fitness/schedule";
import type { FitnessClassType } from "@/types/database";

export interface ClassWeek {
  days: string[];
  classes: FitnessClass[];
  studios: FitnessStudio[];
  /** When the morning job last read schedules for this app, or null if it never has. */
  readAt: string | null;
  /** Set when the answer holds one day's classes only (asked with ?day=). */
  day?: string;
}

const asType = (t: string): FitnessClassType | "other" => ((CLASS_TYPE_KEYS as string[]).includes(t) ? (t as FitnessClassType) : "other");

/**
 * Every class an app's studios list for the 7 days starting at `from`, with the studios (for names, distance and booking).
 * With `onlyDay` (one of those days) the classes are that day's alone: the page asks for today first, so it can show
 * something after one small answer, then fetches the other six days behind it.
 */
export async function getClassWeek(appId: string, from: string, onlyDay?: string): Promise<ClassWeek> {
  const admin = createAdminClient();
  const days = nextDays(from, 7);
  const first = onlyDay ?? days[0], last = onlyDay ?? days[days.length - 1];
  // The database answers at most 1,000 rows per request whatever limit is asked for, and a week across the city's studios
  // is close to 4,000. Reading a page at a time until one came back short was five round trips in a row (over a second
  // before the page could show anything); now one count says how many pages there are, and they are all read at once.
  const PAGE = 1000;
  const thisWeek = <T extends { eq: (c: string, v: string) => T; gte: (c: string, v: string) => T; lte: (c: string, v: string) => T; neq: (c: string, v: string) => T }>(q: T) =>
    q.eq("app_id", appId).gte("class_date", first).lte("class_date", last).neq("class_type", "other");
  const [{ data: studios }, { count }] = await Promise.all([
    admin.from("fitness_studios").select("*").eq("app_id", appId),
    thisWeek(admin.from("fitness_classes").select("id", { count: "exact", head: true })),
  ]);
  const pages = await Promise.all(
    Array.from({ length: Math.max(1, Math.ceil((count ?? 0) / PAGE)) }, (_, i) =>
      thisWeek(admin.from("fitness_classes").select("id, studio_id, class_date, start_time, end_time, name, instructor, spots, class_type, online"))
        .order("class_date")
        .order("start_time")
        .order("id")
        .range(i * PAGE, (i + 1) * PAGE - 1)
    )
  );
  const rows = pages.flatMap((p) => p.data ?? []);
  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);
  return {
    days,
    ...(onlyDay ? { day: onlyDay } : {}),
    classes: (rows ?? []).map((r) => ({
      id: r.id,
      studioId: r.studio_id,
      date: r.class_date,
      start: hhmm(r.start_time)!,
      end: hhmm(r.end_time),
      name: r.name,
      instructor: r.instructor,
      spots: r.spots,
      type: asType(r.class_type),
      online: r.online,
    })),
    studios: (studios ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      bookUrl: s.schedule_url,
      website: s.website,
      readStatus: s.read_status,
      classCount: s.class_count,
      neighborhood: s.neighborhood ?? null,
    })),
    readAt: (studios ?? []).reduce<string | null>((max, s) => (s.read_at && (!max || s.read_at > max) ? s.read_at : max), null),
  };
}
