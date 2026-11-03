import { describe, expect, it } from "vitest";
import { withNext } from "@/lib/auth/next-path";
import { domainsReturnPath, findOfferForBuy, isBuyableDomain, normalizeDomainName, priceLabel, searchCandidates, searchLabel, typedTld } from "./buy";

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

describe("domainsReturnPath", () => {
  it("keeps the search term and adds the domain to buy", () => {
    expect(domainsReturnPath("costume contests", "costumecontestsseattle.com")).toBe("/domains?q=costume%20contests&buy=costumecontestsseattle.com");
  });

  it("leaves buy out when there is no domain", () => {
    expect(domainsReturnPath("brand", null)).toBe("/domains?q=brand");
    expect(domainsReturnPath("brand")).toBe("/domains?q=brand");
    expect(domainsReturnPath("  ", "brand.com")).toBe("/domains?q=&buy=brand.com");
  });

  it("encodes the query once, so it survives being carried in next through signup and onboarding", () => {
    const path = domainsReturnPath("a b&c=d", "Brand.COM");
    expect(path).toBe("/domains?q=a%20b%26c%3Dd&buy=Brand.COM");

    const link = new URL(withNext("/signup", path), "https://tapandlaunch.com");
    expect(link.pathname).toBe("/signup");
    expect(link.searchParams.get("next")).toBe(path);

    // Reading the return path back gives the search term and the domain exactly as they were typed.
    const back = new URL(link.searchParams.get("next") ?? "", "https://tapandlaunch.com");
    expect(back.pathname).toBe("/domains");
    expect(back.searchParams.get("q")).toBe("a b&c=d");
    expect(back.searchParams.get("buy")).toBe("Brand.COM");
  });
});

describe("findOfferForBuy", () => {
  const offers = [
    { domain: "foo.com", available: true },
    { domain: "bar.com", available: false },
  ];

  it("matches the same domain whatever case or stray spaces came in through the URL", () => {
    expect(findOfferForBuy(offers, "  FOO.COM ")).toBe(offers[0]);
    expect(findOfferForBuy(offers, "Bar.Com")).toBe(offers[1]);
  });

  it("gives nothing when the domain is gone, or there was no buy to resume", () => {
    expect(findOfferForBuy(offers, "baz.com")).toBeUndefined();
    expect(findOfferForBuy(offers, null)).toBeUndefined();
    expect(findOfferForBuy(offers, "   ")).toBeUndefined();
    expect(findOfferForBuy([], "foo.com")).toBeUndefined();
  });

  it("normalises a domain the same way wherever it came from", () => {
    expect(normalizeDomainName(" Brand.COM ")).toBe("brand.com");
    expect(normalizeDomainName(null)).toBe("");
    expect(normalizeDomainName(undefined)).toBe("");
  });
});
