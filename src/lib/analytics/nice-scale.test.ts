import { describe, expect, it } from "vitest";
import { niceMax } from "@/lib/analytics/nice-scale";

describe("niceMax", () => {
  it("returns 1 for zero and negative values", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-3)).toBe(1);
  });

  it("keeps small positive values at their nice step", () => {
    expect(niceMax(1)).toBe(1);
    expect(niceMax(7)).toBe(10);
  });

  it("rounds up to the next 1/2/5 × power of ten", () => {
    expect(niceMax(12)).toBe(20);
    expect(niceMax(130)).toBe(200);
    expect(niceMax(4.2)).toBe(5);
  });
});
