import { describe, expect, it } from "vitest";
import { addressFor, randomAddress, slugify } from "./slug";

describe("slugify", () => {
  it("makes lowercase words joined by hyphens", () => {
    expect(slugify("Maple Street Bakery")).toBe("maple-street-bakery");
    expect(slugify("  Taco  Loco!! ")).toBe("taco-loco");
  });
  it("keeps the letter under an accent instead of cutting a hole", () => {
    expect(slugify("Café Ñandú")).toBe("cafe-nandu");
    expect(slugify("Crème brûlée & Co")).toBe("creme-brulee-co");
  });
  it("never ends in a hyphen, even when the cut at 63 characters lands on one", () => {
    const name = `${"k".repeat(62)} b`; // the 63rd character is the hyphen between the words
    const slug = slugify(name);
    expect(slug.length).toBeLessThanOrEqual(63);
    expect(slug).toBe("k".repeat(62));
    expect(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)).toBe(true);
  });
  it("gives nothing for a name with no readable letters or digits", () => {
    for (const name of ["日本語カフェ", "🍕🍕🍕", "!!!", "   "]) expect(slugify(name)).toBe("");
  });
});

describe("randomAddress", () => {
  const valid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  it("makes a valid address with the prefix and a six-character tail", () => {
    expect(randomAddress("app", () => 0.123456789)).toMatch(/^app-[a-z0-9]{6}$/);
    expect(randomAddress(undefined, () => 0.987654321)).toMatch(/^workspace-[a-z0-9]{6}$/);
    expect(valid.test(randomAddress("app"))).toBe(true);
  });
  it("still has six characters when the random number has few digits", () => {
    expect(randomAddress("app", () => 0.5)).toMatch(/^app-[a-z0-9]{6}$/);
    expect(randomAddress("app", () => 0)).toMatch(/^app-[a-z0-9]{6}$/);
  });
  it("differs from one call to the next", () => {
    expect(randomAddress("app", () => 0.111111)).not.toBe(randomAddress("app", () => 0.999999));
  });
});

describe("addressFor", () => {
  it("uses the name when it can", () => {
    expect(addressFor("Maple Street Bakery", "app-abc123")).toBe("maple-street-bakery");
  });
  it("uses the given fallback for names with no letters or digits we can read, so shown and saved agree", () => {
    for (const name of ["日本語カフェ", "🍕🍕🍕", "!!!"]) expect(addressFor(name, "app-abc123")).toBe("app-abc123");
  });
  it("makes its own valid fallback when none is given", () => {
    expect(addressFor("日本語カフェ")).toMatch(/^workspace-[a-z0-9]{6}$/);
  });
});
