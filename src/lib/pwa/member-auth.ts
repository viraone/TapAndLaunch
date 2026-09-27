import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * Password hashing for `app_members` (end-users of a published app — see
 * the README on why they're not Supabase Auth users). Uses Node's built-in
 * `crypto.scrypt` rather than adding a `bcrypt`/`argon2` dependency —
 * scrypt is a fine, standard choice for this and needs nothing beyond the
 * Node runtime these Route Handlers already run on by default.
 *
 * Stored format: `{salt-hex}:{derived-key-hex}`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const storedKey = Buffer.from(keyHex, "hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return derivedKey.length === storedKey.length && timingSafeEqual(derivedKey, storedKey);
}
