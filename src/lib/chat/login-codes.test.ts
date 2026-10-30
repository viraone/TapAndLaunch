import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  generateLoginCode,
  hashLoginCode,
  LOGIN_CODE_TTL_MS,
  MAX_LOGIN_CODE_ATTEMPTS,
  MAX_LOGIN_CODES_PER_HOUR,
  verifyLoginCode,
} from "./login-codes";

describe("group chat login codes", () => {
  it("makes a six-digit code, keeping leading zeroes", () => {
    for (let i = 0; i < 50; i++) expect(generateLoginCode()).toMatch(/^\d{6}$/);
  });

  it("stores only a SHA-256 hash of the code and the server secret", () => {
    const hash = hashLoginCode("123456", "secret-a");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe("123456");
    expect(hashLoginCode("123456", "secret-a")).toBe(hash);
    expect(hashLoginCode("654321", "secret-a")).not.toBe(hash);
    expect(hashLoginCode("123456", "secret-b")).not.toBe(hash);
  });

  it("accepts only the matching code with the matching secret", () => {
    const hash = hashLoginCode("123456", "secret-a");
    expect(verifyLoginCode("123456", hash, "secret-a")).toBe(true);
    expect(verifyLoginCode("123457", hash, "secret-a")).toBe(false);
    expect(verifyLoginCode("123456", hash, "secret-b")).toBe(false);
    expect(verifyLoginCode("123456", "not-a-hash", "secret-a")).toBe(false);
  });

  it("keeps codes short-lived and guess-limited", () => {
    expect(LOGIN_CODE_TTL_MS).toBe(10 * 60 * 1000);
    expect(MAX_LOGIN_CODES_PER_HOUR).toBe(5);
    expect(MAX_LOGIN_CODE_ATTEMPTS).toBe(5);
  });
});
