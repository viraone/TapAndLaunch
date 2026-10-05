import { describe, expect, it } from "vitest";
import { formatLocal, formatUtc } from "./LocalTime";

describe("LocalTime formatting", () => {
  const iso = "2026-10-05T01:30:00Z";

  it("shows the viewer's own time zone", () => {
    expect(formatLocal(iso, false, "en-US", "America/Los_Angeles")).toBe("Oct 4, 2026, 6:30 PM");
    expect(formatLocal(iso, false, "en-US", "Asia/Tokyo")).toBe("Oct 5, 2026, 10:30 AM");
  });

  it("falls back to labelled UTC for the server render", () => {
    expect(formatUtc(iso, false)).toBe("Oct 5, 2026, 1:30 AM UTC");
    expect(formatUtc(iso, true)).toBe("Oct 5, 2026");
  });

  it("returns nothing for a bad date instead of throwing", () => {
    expect(formatLocal("nope", false)).toBe("");
  });
});
