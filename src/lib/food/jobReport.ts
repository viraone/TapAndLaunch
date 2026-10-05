import { timingSafeEqual } from "node:crypto";

/** The member tier that receives the daily job report on their phone. Only the owner's own member account is put in it. */
export const OWNER_TIER = "owner";

/**
 * Whether a request carries the job's credential: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`, the key the job on the
 * owner's Mac already holds (so no new secret exists). Constant-time; an empty or missing secret never matches.
 */
export function isJobAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const given = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
