import { describe, expect, it } from "vitest";
import { isApexDomain, routingRecord } from "./dns";

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
