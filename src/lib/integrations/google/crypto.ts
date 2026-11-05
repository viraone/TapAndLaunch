import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Seals a Google refresh token before it is stored. AES-256-GCM, with a fresh random IV for every write, so the same
 * token never produces the same stored value twice. The key is GOOGLE_TOKEN_ENC_KEY: base64 of exactly 32 random bytes.
 *
 * Format: "v1.<iv>.<tag>.<ciphertext>", every part base64url.
 */
const BAD_SEAL = "Could not read the saved connection";

function decodeKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("GOOGLE_TOKEN_ENC_KEY must be 32 bytes of base64");
  return key;
}

/** Strict base64url, so a changed or malformed character is refused rather than silently skipped. */
function decodePart(part: string, expectedLength: number | null): Buffer {
  const bytes = Buffer.from(part, "base64url");
  if (bytes.toString("base64url") !== part) throw new Error("bad part");
  if (expectedLength !== null && bytes.length !== expectedLength) throw new Error("bad length");
  return bytes;
}

export function encryptSecret(plain: string, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/** The plain token, or the one error the dashboard may show. Wrong key, damaged text and failed auth all look the same. */
export function decryptSecret(sealed: string, keyBase64: string): string {
  try {
    const key = decodeKey(keyBase64);
    const parts = sealed.split(".");
    if (parts.length !== 4) throw new Error("bad shape");
    const [version, ivPart, tagPart, dataPart] = parts;
    if (version !== "v1") throw new Error("bad version");
    const iv = decodePart(ivPart, 12);
    const tag = decodePart(tagPart, 16);
    const data = decodePart(dataPart, null);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new Error(BAD_SEAL);
  }
}
