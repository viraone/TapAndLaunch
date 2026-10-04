/**
 * Walking time shown on a LiveBites card. It is an estimate from the straight-line distance
 * we already have for every place (no extra Google calls, works the moment the list loads):
 * real streets run about a third longer than a straight line, and people walk about 3 mph.
 * Google Maps (the Go button) shows the exact route.
 */
const STREET_FACTOR = 1.3;
const WALK_MPH = 3;

/** Whole minutes to walk `miles` (as the crow flies) along real streets, at least 1. */
export function walkMinutes(miles: number): number {
  const minutes = ((Math.max(0, miles) * STREET_FACTOR) / WALK_MPH) * 60;
  return Math.max(1, Math.round(minutes));
}

/** "1 min", "14 min", "1 hr 5 min", "2 hr". */
export function walkLabel(miles: number): string {
  const total = walkMinutes(miles);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** City driving: streets ~30% longer than a straight line, ~18 mph average, plus ~2 min to get going and park. */
const DRIVE_MPH = 18;
const DRIVE_OVERHEAD_MIN = 2;

/** Whole minutes to drive `miles` (as the crow flies), at least 2. */
export function driveMinutes(miles: number): number {
  const minutes = ((Math.max(0, miles) * STREET_FACTOR) / DRIVE_MPH) * 60 + DRIVE_OVERHEAD_MIN;
  return Math.max(2, Math.round(minutes));
}

/** Longest walk we offer as the default; past this the card shows the drive instead (like Apple Maps' travel-time button). */
export const MAX_WALK_MINUTES = 20;

export type TravelMode = "walking" | "driving";

/** The mode and estimate the card's directions button shows, e.g. { mode: "walking", minutes: 13, label: "~13 min" }. */
export function travelEstimate(miles: number): { mode: TravelMode; minutes: number; label: string } {
  const walk = walkMinutes(miles);
  if (walk <= MAX_WALK_MINUTES) return { mode: "walking", minutes: walk, label: `~${walkLabel(miles)}` };
  const drive = driveMinutes(miles);
  return { mode: "driving", minutes: drive, label: `~${drive} min` };
}
