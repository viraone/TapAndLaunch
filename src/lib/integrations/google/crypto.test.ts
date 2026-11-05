import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const KEY = randomBytes(32).toString("base64");
const SECRET = "1//refresh-token-that-can-send-email";

/** Changes the first character of one base64url part. */
function flip(part: string): string {
  return `${part[0] === "A" ? "B" : "A"}${part.slice(1)}`;
}

describe("encryptSecret / decryptSecret", () => {
  it("round trips the plain text", () => {
    expect(decryptSecret(encryptSecret(SECRET, KEY), KEY)).toBe(SECRET);
  });

  it("encrypts the same text differently every time", () => {
    expect(encryptSecret(SECRET, KEY)).not.toBe(encryptSecret(SECRET, KEY));
  });

  it("refuses a changed IV", () => {
    const [version, iv, tag, data] = encryptSecret(SECRET, KEY).split(".");
    expect(() => decryptSecret([version, flip(iv), tag, data].join("."), KEY)).toThrow(
      "Could not read the saved connection"
    );
  });

  it("refuses a changed auth tag", () => {
    const [version, iv, tag, data] = encryptSecret(SECRET, KEY).split(".");
    expect(() => decryptSecret([version, iv, flip(tag), data].join("."), KEY)).toThrow(
      "Could not read the saved connection"
    );
  });

  it("refuses changed ciphertext", () => {
    const [version, iv, tag, data] = encryptSecret(SECRET, KEY).split(".");
    expect(() => decryptSecret([version, iv, tag, flip(data)].join("."), KEY)).toThrow(
      "Could not read the saved connection"
    );
  });

  it("refuses a different key", () => {
    const otherKey = randomBytes(32).toString("base64");
    expect(() => decryptSecret(encryptSecret(SECRET, KEY), otherKey)).toThrow(
      "Could not read the saved connection"
    );
  });

  it("refuses malformed text", () => {
    for (const bad of ["", "not-a-sealed-value", "v2.a.b.c", "v1.a.b"]) {
      expect(() => decryptSecret(bad, KEY)).toThrow("Could not read the saved connection");
    }
  });

  it("refuses a key that is not 32 bytes when encrypting", () => {
    expect(() => encryptSecret(SECRET, randomBytes(31).toString("base64"))).toThrow();
    expect(() => encryptSecret(SECRET, randomBytes(33).toString("base64"))).toThrow();
  });
});
