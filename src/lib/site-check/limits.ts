/**
 * In-memory limits for the public "check my site" page: how often one visitor may run a check, how many checks run at once on this
 * server instance, and (pure) the per-host cooldown that makes a second check of the same site replay the saved report.
 */
import { createHash } from "node:crypto";

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 3;
const COOLDOWN_MS = 60 * 60_000;
const MAX_CONCURRENT = 2;

const runs = new Map<string, number[]>();
let active = 0;

/** True when this visitor may run another check; records the attempt when they may. */
export function allowRun(address: string, now = Date.now(), max = MAX_PER_WINDOW): boolean {
  const recent = (runs.get(address) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) {
    runs.set(address, recent);
    return false;
  }
  recent.push(now);
  runs.set(address, recent);
  // Forget quiet visitors so the map does not grow for ever.
  if (runs.size > 5000) for (const [k, v] of runs) if (v.every((t) => now - t >= WINDOW_MS)) runs.delete(k);
  return true;
}

/** Try to take one of the server's concurrent-check slots. False when they are all busy. */
export function tryStart(max = MAX_CONCURRENT): boolean {
  if (active >= max) return false;
  active += 1;
  return true;
}

/** Release a concurrent-check slot. */
export function finish(): void {
  active = Math.max(0, active - 1);
}

/** The newest timestamp still inside the cooldown, or null when none is recent enough to replay. */
export function latestWithinCooldown(timestamps: number[], now = Date.now(), cooldownMs = COOLDOWN_MS): number | null {
  let latest: number | null = null;
  for (const t of timestamps) {
    if (now - t < cooldownMs && (latest === null || t > latest)) latest = t;
  }
  return latest;
}

/** The visitor's address as the platform sees it (Vercel sets x-forwarded-for; locally there is none). */
export function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function salt(): string {
  return process.env.SITE_CHECK_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

/** sha256 of the visitor's address plus a server secret, so the raw address is never stored. */
export function hashVisitor(address: string): string {
  return createHash("sha256").update(address).update(":").update(salt()).digest("hex");
}
