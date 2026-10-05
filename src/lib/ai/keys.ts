import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Customers' AI keys are encrypted with AES-256-GCM before they are stored. The encryption key comes from
 * `AI_KEY_SECRET` if set, otherwise it is derived (HKDF, with its own label) from `MEMBER_SESSION_SECRET`, which every
 * environment already has. Changing whichever secret is used makes saved keys unreadable; customers would re-enter them.
 */
function encryptionKey(): Buffer {
  const secret = process.env.AI_KEY_SECRET || process.env.MEMBER_SESSION_SECRET;
  if (!secret) throw new Error("No secret to encrypt AI keys with (set AI_KEY_SECRET or MEMBER_SESSION_SECRET)");
  return Buffer.from(hkdfSync("sha256", secret, "tapandlaunch", "ai-keys:v1", 32));
}

export function encryptSecret(plain: string, key: Buffer = encryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(stored: string, key: Buffer = encryptionKey()): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised encrypted key");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** "…a1b2": all a person ever sees of a saved key. */
export function keyHint(key: string): string {
  return `…${key.trim().slice(-4)}`;
}
