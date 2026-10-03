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
