/** Opening hours change rarely, and status is computed live from them, so
 * a fetched (cell, group) is trusted for a week. */
export const CELL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Websites and phone numbers started being saved on 2026-10-03 (about 3:54 PM Pacific). Places stored before
 * that have none, even when Google has one (Kajiken's Capitol Hill row had no website for that reason), so any
 * area fetched before this moment is fetched again the next time someone opens it. Once every area has been
 * fetched since, this does nothing and can be deleted. */
export const CONTACT_FIELDS_SINCE_MS = Date.parse("2026-10-04T00:00:00Z");

/** Whether a (cell, group) fetched at `fetchedAt` can still be trusted. */
export function isCellFresh(fetchedAt: string, now: number = Date.now()): boolean {
  const at = new Date(fetchedAt).getTime();
  return now - at < CELL_TTL_MS && at >= CONTACT_FIELDS_SINCE_MS;
}
