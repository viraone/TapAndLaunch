import { describe, expect, it } from "vitest";
import { isHeaderBannerActive } from "./header-banner";

const B = { title: "T", url: "https://example.com/x" };

describe("isHeaderBannerActive", () => {
  it("returns false for undefined banner", () => {
    expect(isHeaderBannerActive(undefined, new Date())).toBe(false);
  });

  it("returns false for empty title or url", () => {
    expect(isHeaderBannerActive({ ...B, title: "  " }, new Date())).toBe(false);
    expect(isHeaderBannerActive({ ...B, url: "" }, new Date())).toBe(false);
  });

  it("returns true when no until or invalid until", () => {
    expect(isHeaderBannerActive(B, new Date())).toBe(true);
    expect(isHeaderBannerActive({ ...B, until: "not-a-date" }, new Date())).toBe(true);
  });

  it("returns true on the last day", () => {
    const banner = { ...B, until: "2026-11-27" };
    expect(isHeaderBannerActive(banner, new Date("2026-11-27T20:00:00-08:00"))).toBe(true);
    expect(isHeaderBannerActive(banner, new Date("2026-11-28T03:00:00Z"))).toBe(true);
  });

  it("returns false after the last day", () => {
    expect(isHeaderBannerActive({ ...B, until: "2026-11-27" }, new Date("2026-11-28T00:30:00-08:00"))).toBe(false);
  });
});
