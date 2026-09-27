/**
 * Rounds a maximum value up to a "nice" round number for axis ticks (1/2/5 ×
 * a power of ten) — per the dataviz skill's mark specs: "Y-axis ticks: round
 * to clean numbers." Returns at least 1 so a chart with all-zero data still
 * has a sane axis rather than dividing by zero.
 */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
