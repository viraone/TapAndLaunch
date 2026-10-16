import { describe, expect, it } from "vitest";
import { TRADES_INDEX, TRADE_PAGES, tradeBySlug } from "./trades";
import { WEBSITE_TOPICS } from "@/lib/apps/templates";
import sitemap from "@/app/sitemap";

describe("TRADE_PAGES", () => {
  it("has one page per website topic, each at its own address", () => {
    expect(TRADE_PAGES.map((t) => t.topic.id)).toEqual(WEBSITE_TOPICS.map((t) => t.id));
    const slugs = TRADE_PAGES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(tradeBySlug("real-estate")?.topic.id).toBe("realestate");
    expect(tradeBySlug("nope")).toBeUndefined();
  });
  it("keeps titles and descriptions short enough for a search result, with no exclamation points", () => {
    for (const t of TRADE_PAGES) {
      expect(t.title.length, t.title).toBeLessThanOrEqual(60);
      expect(t.description.length, t.description).toBeLessThanOrEqual(160);
      expect(t.description).toContain("Free for 30 days");
      expect(t.title + t.description + t.headline).not.toContain("!");
    }
    expect(TRADES_INDEX.title.length).toBeLessThanOrEqual(60);
    expect(TRADES_INDEX.description.length).toBeLessThanOrEqual(160);
  });
  it("lists only what the starter really has, in plain words", () => {
    const photo = tradeBySlug("photography")!;
    expect(photo.includes).toContain("a photo gallery");
    expect(photo.includes).toContain("a contact form");
    expect(photo.includes.at(-1)).toBe("About and Contact pages");
    const consulting = tradeBySlug("consulting")!;
    expect(consulting.includes).not.toContain("a photo gallery");
    expect(consulting.includes).toContain("bookings people make online");
    for (const t of TRADE_PAGES) expect(t.includes.length).toBeGreaterThanOrEqual(5);
  });
  it("never invents customer counts or ratings in its own words", () => {
    for (const t of TRADE_PAGES) expect(t.headline + " " + t.description).not.toMatch(/\d[\d,]*\+? (customers|users|businesses)|★|rated|trusted by/i);
  });
});

describe("sitemap", () => {
  it("lists the trades index and every trade page", () => {
    const paths = sitemap().map((e) => new URL(e.url).pathname);
    expect(paths).toContain("/for");
    for (const t of TRADE_PAGES) expect(paths).toContain(`/for/${t.slug}`);
  });
});
