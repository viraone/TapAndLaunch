import { describe, expect, it } from "vitest";
import { isLineupPreviewer } from "./preview-emails";

describe("isLineupPreviewer", () => {
  it("matches an email on the list", () => {
    expect(isLineupPreviewer(["v.xayananh@yahoo.com"], "v.xayananh@yahoo.com")).toBe(true);
  });

  it("ignores case and surrounding spaces on both sides", () => {
    expect(isLineupPreviewer(["  V.Xayananh@Yahoo.com "], " v.xayananh@YAHOO.com ")).toBe(true);
  });

  it("matches any entry in a longer list", () => {
    expect(isLineupPreviewer(["first@example.com", "second@example.com"], "second@example.com")).toBe(true);
  });

  it("does not match an email that is not on the list", () => {
    expect(isLineupPreviewer(["first@example.com", "second@example.com"], "third@example.com")).toBe(false);
  });

  it("answers false when the setting is missing or is not a list", () => {
    for (const emails of [undefined, null, "v.xayananh@yahoo.com", { email: "v.xayananh@yahoo.com" }, 42]) {
      expect(isLineupPreviewer(emails, "v.xayananh@yahoo.com")).toBe(false);
    }
  });

  it("answers false for an empty list", () => {
    expect(isLineupPreviewer([], "v.xayananh@yahoo.com")).toBe(false);
  });

  it("skips entries that are not strings", () => {
    expect(isLineupPreviewer([null, 42, { email: "v.xayananh@yahoo.com" }], "v.xayananh@yahoo.com")).toBe(false);
    expect(isLineupPreviewer([null, "v.xayananh@yahoo.com"], "v.xayananh@yahoo.com")).toBe(true);
  });

  it("answers false when nobody is signed in", () => {
    expect(isLineupPreviewer(["v.xayananh@yahoo.com"], null)).toBe(false);
    expect(isLineupPreviewer(["v.xayananh@yahoo.com"], undefined)).toBe(false);
  });

  it("answers false for an empty or whitespace-only email", () => {
    expect(isLineupPreviewer(["", "  "], "")).toBe(false);
    expect(isLineupPreviewer(["", "  "], "   ")).toBe(false);
  });
});
