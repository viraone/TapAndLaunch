import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * The group chat's passwordless sign-in code (migration 0051): a random six-digit number, emailed to an address on
 * the allowlist. Only a SHA-256 hash of the code and the server's session secret is stored, so a database read
 * cannot produce a working code; verifying compares hashes in constant time.
 */

/** A code works for ten minutes after it is sent. */
export const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;

/** At most five codes per address per hour, so one person cannot be flooded (and Resend is not abused). */
export const MAX_LOGIN_CODES_PER_HOUR = 5;

/** Five wrong guesses burn a code; a fresh one has to be sent. */
export const MAX_LOGIN_CODE_ATTEMPTS = 5;

/** A fresh six-digit code, keeping leading zeroes ("007123"). */
export function generateLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** The stored hash: SHA-256 of the code followed by the server secret, hex-encoded. */
export function hashLoginCode(code: string, secret: string): string {
  return createHash("sha256").update(`${code}${secret}`).digest("hex");
}

/** Whether `code` is the one behind `storedHash`, compared without leaking where the first difference is. */
export function verifyLoginCode(code: string, storedHash: string, secret: string): boolean {
  const expected = Buffer.from(hashLoginCode(code, secret), "hex");
  const actual = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
