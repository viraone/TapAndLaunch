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
}

const asType = (t: string): FitnessClassType | "other" => ((CLASS_TYPE_KEYS as string[]).includes(t) ? (t as FitnessClassType) : "other");

/** Every class an app's studios list for the 7 days starting at `from`, with the studios (for names, distance and booking). */
export async function getClassWeek(appId: string, from: string): Promise<ClassWeek> {
  const admin = createAdminClient();
  const days = nextDays(from, 7);
  // The database answers at most 1,000 rows per request whatever limit is asked for, and a week across the city's studios
  // is more than that, so the classes are fetched a page at a time until a page comes back short.
  const PAGE = 1000;
  const fetchClasses = async () => {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data } = await admin
        .from("fitness_classes")
        .select("id, studio_id, class_date, start_time, end_time, name, instructor, spots, class_type, online")
        .eq("app_id", appId)
        .gte("class_date", days[0])
        .lte("class_date", days[days.length - 1])
        .neq("class_type", "other")
        .order("class_date")
        .order("start_time")
        .order("id")
        .range(from, from + PAGE - 1);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  };
  const [{ data: studios }, rows] = await Promise.all([admin.from("fitness_studios").select("*").eq("app_id", appId), fetchClasses()]);
  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);
  return {
    days,
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
    })),
    readAt: (studios ?? []).reduce<string | null>((max, s) => (s.read_at && (!max || s.read_at > max) ? s.read_at : max), null),
  };
}
