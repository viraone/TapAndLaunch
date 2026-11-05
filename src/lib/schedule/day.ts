import { addDays, zonedTimeToUtc } from "./recurrence";

/** A window of local calendar days: `start` inclusive, `end` exclusive, both as UTC instants. */
export interface DayBounds {
  start: Date;
  end: Date;
}

/**
 * The UTC instants where a local calendar day ("YYYY-MM-DD") starts and where the next one starts, in an IANA zone.
 * Built from both days' local midnight, so a 23- or 25-hour daylight-saving day is exactly as long as the clock says.
 */
export function localDayBounds(date: string, timeZone: string): DayBounds {
  return {
    start: zonedTimeToUtc(date, "00:00", timeZone),
    end: zonedTimeToUtc(addDays(date, 1), "00:00", timeZone),
  };
}

/** `dayCount` local calendar days starting on `fromDate`: `start` inclusive, `end` exclusive. */
export function localDaysBounds(fromDate: string, dayCount: number, timeZone: string): DayBounds {
  if (!Number.isInteger(dayCount) || dayCount < 0) {
    throw new Error("Invalid day count");
  }
  return {
    start: zonedTimeToUtc(fromDate, "00:00", timeZone),
    end: zonedTimeToUtc(addDays(fromDate, dayCount), "00:00", timeZone),
  };
}

/** The visits that start inside the window, soonest first. */
export function visitsWithin<T extends { starts_at: string }>(visits: readonly T[], bounds: DayBounds): T[] {
  const start = bounds.start.getTime();
  const end = bounds.end.getTime();
  return visits
    .filter((visit) => {
      const at = new Date(visit.starts_at).getTime();
      return at >= start && at < end;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

/** How many visits start inside the window, optionally only the ones in the given statuses. */
export function countVisitsWithin<T extends { starts_at: string; status: string }>(
  visits: readonly T[],
  bounds: DayBounds,
  statuses?: readonly string[]
): number {
  return visitsWithin(visits, bounds).filter((visit) => !statuses || statuses.includes(visit.status)).length;
}
