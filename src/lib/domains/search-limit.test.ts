import { describe, expect, it } from "vitest";
import { allowSearch } from "./search-limit";

describe("allowSearch", () => {
  it("lets an address search up to the limit each minute, then not", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allowSearch("1.2.3.4", t0 + i, 3)).toBe(true);
    expect(allowSearch("1.2.3.4", t0 + 10, 3)).toBe(false);
    expect(allowSearch("5.6.7.8", t0 + 10, 3)).toBe(true);
    expect(allowSearch("1.2.3.4", t0 + 61_000, 3)).toBe(true);
  });
});
