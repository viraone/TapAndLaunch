import { describe, expect, it } from "vitest";
import { isBuyableDomain, priceLabel, searchCandidates, searchLabel, typedTld } from "./buy";

describe("searchLabel", () => {
  it("turns words into one label", () => {
    expect(searchLabel("Costume Contests Seattle")).toBe("costumecontestsseattle");
    expect(searchLabel("  costume-contests seattle! ")).toBe("costume-contestsseattle");
  });

  it("keeps only the name part of a typed domain or address", () => {
    expect(searchLabel("costumecontestsseattle.com")).toBe("costumecontestsseattle");
    expect(searchLabel("https://www.Brand.org/about")).toBe("brand");
    expect(searchLabel("www.brand")).toBe("brand");
  });

  it("drops hyphens at the ends", () => {
    expect(searchLabel("-brand-")).toBe("brand");
  });
});

describe("typedTld", () => {
  it("reads an ending we sell and ignores the rest", () => {
    expect(typedTld("brand.org")).toBe("org");
    expect(typedTld("brand.NET ")).toBe("net");
    expect(typedTld("brand.io")).toBeNull();
    expect(typedTld("brand")).toBeNull();
  });
});

describe("searchCandidates", () => {
  it("prices .com first for plain words, then .net and .org", () => {
    expect(searchCandidates("costume contests seattle")).toEqual(["costumecontestsseattle.com", "costumecontestsseattle.net", "costumecontestsseattle.org"]);
  });

  it("puts the typed ending first", () => {
    expect(searchCandidates("brand.org")).toEqual(["brand.org", "brand.com", "brand.net"]);
  });

  it("gives nothing for an empty or unusable search", () => {
    expect(searchCandidates("   ")).toEqual([]);
    expect(searchCandidates("!!!")).toEqual([]);
  });
});

describe("isBuyableDomain", () => {
  it("accepts one label with an ending we sell", () => {
    expect(isBuyableDomain("costumecontestsseattle.com")).toBe(true);
    expect(isBuyableDomain("Brand.ORG")).toBe(true);
  });

  it("refuses subdomains, other endings and bad labels", () => {
    expect(isBuyableDomain("www.brand.com")).toBe(false);
    expect(isBuyableDomain("brand.io")).toBe(false);
    expect(isBuyableDomain("-brand.com")).toBe(false);
    expect(isBuyableDomain("brand")).toBe(false);
  });
});

describe("priceLabel", () => {
  it("says the yearly price, and the first-year price when it differs", () => {
    expect(priceLabel(1729, 1729)).toBe("$17.29 a year");
    expect(priceLabel(1079, 1499)).toBe("$10.79 for the first year, then $14.99 a year");
  });
});
