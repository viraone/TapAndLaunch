/** Scales a picture down so its longer side is at most `max`, keeping its shape. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  if (Math.max(width, height) <= max) {
    return { width, height };
  }
  const scale = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
