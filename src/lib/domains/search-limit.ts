/**
 * A small per-address limit for the public domain search, so one visitor (or a script) cannot hammer the registrar's
 * API through us. In memory, per server instance: enough to blunt abuse, not an accounting system.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

const hits = new Map<string, number[]>();

/** True when this address may search again; records the attempt when it may. */
export function allowSearch(address: string, now = Date.now(), max = MAX_PER_WINDOW): boolean {
  const recent = (hits.get(address) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) {
    hits.set(address, recent);
    return false;
  }
  recent.push(now);
  hits.set(address, recent);
  // Forget quiet addresses so the map doesn't grow for ever.
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return true;
}

/** The visitor's address as the platform sees it (Vercel sets x-forwarded-for; locally there is none). */
export function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
