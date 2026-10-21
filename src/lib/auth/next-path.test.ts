import { describe, expect, it } from "vitest";
import { safeNextPath, withNext } from "./next-path";

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/reset-password", "/onboarding")).toBe("/reset-password");
    expect(safeNextPath("/dashboard?x=1", "/onboarding")).toBe("/dashboard?x=1");
  });
  it("falls back for anything else", () => {
    for (const bad of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "reset", "/" + "a".repeat(300)]) {
      expect(safeNextPath(bad, "/onboarding")).toBe("/onboarding");
    }
  });
});

describe("withNext", () => {
  it("carries the path along, encoded, or leaves the address plain", () => {
    expect(withNext("/login", "/domains?q=a b")).toBe("/login?next=%2Fdomains%3Fq%3Da%20b");
    expect(withNext("/login", null)).toBe("/login");
  });
});
