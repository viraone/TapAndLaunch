import { describe, expect, it } from "vitest";
import { companionDomain, companionRecord, isApexDomain, routingRecord } from "./dns";

describe("isApexDomain", () => {
  it("knows root domains from subdomains", () => {
    expect(isApexDomain("brand.com")).toBe(true);
    expect(isApexDomain("brand.co.uk")).toBe(true);
    expect(isApexDomain("app.brand.com")).toBe(false);
    expect(isApexDomain("www.brand.co.uk")).toBe(false);
  });
});

describe("routingRecord", () => {
  it("uses a CNAME for a subdomain, with Vercel's recommended target", () => {
    expect(routingRecord("app.brand.com", { recommendedCNAME: [{ rank: 2, value: "b.vercel-dns.com." }, { rank: 1, value: "a.vercel-dns-017.com." }] })).toEqual({
      type: "CNAME",
      domain: "app",
      value: "a.vercel-dns-017.com",
      reason: "Points your domain at TapAndLaunch",
    });
  });
  it("falls back to Vercel's long-standing CNAME", () => {
    expect(routingRecord("app.brand.com", null).value).toBe("cname.vercel-dns.com");
  });
  it("uses an A record for a root domain", () => {
    expect(routingRecord("brand.com", { recommendedIPv4: [{ rank: 1, value: ["76.76.21.21"] }] })).toMatchObject({ type: "A", domain: "@", value: "76.76.21.21" });
    expect(routingRecord("brand.com", null)).toMatchObject({ type: "A", value: "76.76.21.21" });
  });
});

describe("companionDomain", () => {
  it("pairs a root domain with its www, and www with its root", () => {
    expect(companionDomain("brand.com")).toBe("www.brand.com");
    expect(companionDomain("www.brand.com")).toBe("brand.com");
    expect(companionDomain("Brand.CO.UK")).toBe("www.brand.co.uk");
    expect(companionDomain("www.brand.co.uk")).toBe("brand.co.uk");
  });
  it("has none for any other subdomain", () => {
    expect(companionDomain("app.brand.com")).toBeNull();
    expect(companionDomain("www.app.brand.com")).toBeNull();
  });
});

describe("companionRecord", () => {
  it("is the www CNAME next to a root domain's A record", () => {
    expect(companionRecord("brand.com", null)).toEqual({
      type: "CNAME",
      domain: "www",
      value: "cname.vercel-dns.com",
      reason: "Sends www.brand.com to brand.com",
    });
  });
  it("is the root A record when the customer connected www", () => {
    expect(companionRecord("www.brand.com", { recommendedIPv4: [{ rank: 1, value: ["216.198.79.1"] }] })).toEqual({
      type: "A",
      domain: "@",
      value: "216.198.79.1",
      reason: "Sends brand.com to www.brand.com",
    });
  });
  it("is nothing for a plain subdomain", () => {
    expect(companionRecord("app.brand.com", null)).toBeNull();
  });
});
