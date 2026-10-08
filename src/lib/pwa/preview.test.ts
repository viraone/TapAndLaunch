import { beforeAll, describe, expect, it } from "vitest";
import { signPreviewToken, verifyPreviewToken } from "./preview";

describe("preview keys for the builder's Try it mode", () => {
  beforeAll(() => {
    process.env.PREVIEW_SECRET = "test-secret";
  });

  it("opens the app it was made for, for an hour", () => {
    const token = signPreviewToken("taco-loco", 1_000_000_000_000);
    expect(verifyPreviewToken(token, "taco-loco", 1_000_000_000_000 + 59 * 60_000)).toBe(true);
    expect(verifyPreviewToken(token, "taco-loco", 1_000_000_000_000 + 61 * 60_000)).toBe(false);
  });

  it("does not open another app", () => {
    const token = signPreviewToken("taco-loco");
    expect(verifyPreviewToken(token, "eats-near-me")).toBe(false);
  });

  it("rejects a tampered or made-up key", () => {
    const token = signPreviewToken("taco-loco");
    const [body, sig] = token.split(".");
    expect(verifyPreviewToken(`${body}.${sig.slice(0, -2)}xx`, "taco-loco")).toBe(false);
    const forged = Buffer.from(`taco-loco:${Math.floor(Date.now() / 1000) + 3600}`).toString("base64url");
    expect(verifyPreviewToken(`${forged}.nope`, "taco-loco")).toBe(false);
    expect(verifyPreviewToken("", "taco-loco")).toBe(false);
    expect(verifyPreviewToken(null, "taco-loco")).toBe(false);
  });
});
