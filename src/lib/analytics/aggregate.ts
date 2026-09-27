export interface DailyCount {
  date: string; // YYYY-MM-DD
  count: number;
}

/**
 * Buckets ISO timestamps into a fixed run of `days` calendar days ending
 * today, zero-filled — so a chart always shows a continuous run of days
 * (no gaps for days with zero events) rather than only the days that
 * happened to have activity.
 */
export function countsByDay(timestamps: string[], days: number): DailyCount[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

export interface PageCount {
  pageId: string;
  pageName: string;
  count: number;
}

/** Ranks pages by event count, descending — highest first, matching how a
 * "most viewed pages" bar chart should read top-to-bottom. */
export function countsByPage(
  events: Array<{ page_id: string | null }>,
  pages: Array<{ id: string; name: string }>
): PageCount[] {
  const nameById = new Map(pages.map((p) => [p.id, p.name]));
  const counts = new Map<string, number>();

  for (const event of events) {
    if (!event.page_id) continue;
    counts.set(event.page_id, (counts.get(event.page_id) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([pageId, count]) => ({ pageId, pageName: nameById.get(pageId) ?? "Unknown page", count }))
    .sort((a, b) => b.count - a.count);
}
