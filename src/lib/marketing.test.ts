import { describe, expect, it } from "vitest";
import { AUDIENCES, FAQ, SITE_DESCRIPTION, WHO_FOR, jsonLdText, structuredData } from "./marketing";
import sitemap from "@/app/sitemap";

const whoForText = [WHO_FOR.types.text, WHO_FOR.size.text, WHO_FOR.region.text, WHO_FOR.notFor.text].join(" ");

describe("WHO_FOR", () => {
  it("names the business types, in the words the page uses", () => {
    for (const phrase of ["restaurants and cafés", "gyms and studios", "shops", "venues and events", "clubs and communities", "photographers, designers and artists"]) {
      expect(whoForText).toContain(phrase);
    }
  });
  it("states the size, with the exact phrase automated readers look for", () => {
    expect(WHO_FOR.size.text).toContain("1-50 employees");
    expect(WHO_FOR.size.text).toContain("solo owners");
  });
  it("states the region and ties payments to the customer's own Stripe account", () => {
    expect(WHO_FOR.region.text).toContain("United States and Canada");
    expect(WHO_FOR.region.text).toContain("your own Stripe account");
    expect(WHO_FOR.region.text).toContain("countries Stripe supports");
  });
  it("says who it is not for", () => {
    expect(WHO_FOR.notFor.text).toMatch(/App Store/);
    expect(WHO_FOR.notFor.text).toMatch(/Google Play/);
    expect(WHO_FOR.notFor.text).toMatch(/mobile engineering team/);
  });
  it("keeps the tone: no exclamation points, no counts or ratings", () => {
    expect(whoForText).not.toContain("!");
    expect(whoForText).not.toMatch(/\d[\d,]*\+? (customers|users|businesses)|★|stars?\b|rated/i);
  });
  it("covers every business type the Built for row lists", () => {
    const lower = whoForText.toLowerCase();
    for (const a of AUDIENCES) {
      const words = a.toLowerCase().split(/ and |, /);
      expect(words.some((w) => lower.includes(w.trim())), a).toBe(true);
    }
  });
});

describe("SITE_DESCRIPTION", () => {
  it("names the category, the business types and the size range", () => {
    expect(SITE_DESCRIPTION).toMatch(/^No-code app builder for restaurants, gyms, shops and event businesses with 1-50 employees\./);
    expect(SITE_DESCRIPTION).toContain("Free for 30 days");
    expect(SITE_DESCRIPTION).not.toContain("!");
  });
  it("is short enough to show in a search result without being cut", () => {
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(200);
  });
});

describe("structuredData", () => {
  it("always names the organization, and adds only the parts a page shows", () => {
    const types = (parts: Array<"software" | "faq">) => structuredData(parts)["@graph"].map((n) => n["@type"]);
    expect(types([])).toEqual(["Organization"]);
    expect(types(["software"])).toEqual(["Organization", "SoftwareApplication"]);
    expect(types(["faq"])).toEqual(["Organization", "FAQPage"]);
    expect(types(["software", "faq"])).toEqual(["Organization", "SoftwareApplication", "FAQPage"]);
  });
  it("lists every question", () => {
    const faq = structuredData(["faq"])["@graph"].find((n) => n["@type"] === "FAQPage") as { mainEntity: unknown[] };
    expect(faq.mainEntity).toHaveLength(FAQ.length);
  });
  it("escapes < so nothing in the data can close the script tag", () => {
    expect(jsonLdText({ a: "</script><b>" })).not.toContain("<");
  });
});

describe("sitemap", () => {
  it("lists the standalone pricing and FAQ pages", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls).toContain("/pricing");
    expect(urls).toContain("/faq");
  });
});
