import { describe, expect, it } from "vitest";
import { addressFor, slugify } from "./slug";

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

describe("addressFor", () => {
  const valid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  it("uses the name when it can", () => {
    expect(addressFor("Maple Street Bakery")).toBe("maple-street-bakery");
  });
  it("makes a valid, different address for names that have no letters we can read", () => {
    const a = addressFor("日本語カフェ", () => 0.123456789);
    const b = addressFor("日本語カフェ", () => 0.987654321);
    expect(a).toMatch(/^workspace-[a-z0-9]{6}$/);
    expect(valid.test(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  it("still makes a valid address when the random number has few digits", () => {
    expect(addressFor("!!!", () => 0.5)).toMatch(/^workspace-[a-z0-9]{6}$/);
    expect(addressFor("!!!", () => 0)).toMatch(/^workspace-[a-z0-9]{6}$/);
  });
});
