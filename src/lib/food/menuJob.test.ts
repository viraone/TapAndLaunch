import { describe, expect, it } from "vitest";
import { findMoreLinks, isDue, RETRY_DAYS } from "../../../tools/menu-ingest/lib.mjs";

// The menu / happy hour job (tools/menu-ingest) decides each morning which places to read. A place whose last read got nothing used
// to have no date saved, so it counted as never checked and came back first every day; these pin the waits that stop that.
const NOW = Date.parse("2026-10-11T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

describe("isDue", () => {
  it("is always due for a place that was never read", () => {
    expect(isDue(null, null, 14, NOW)).toBe(true);
    expect(isDue(undefined, "error", 14, NOW)).toBe(true);
  });

  it("waits the normal refresh window after a read that worked", () => {
    expect(isDue(daysAgo(5), "ok", 14, NOW)).toBe(false);
    expect(isDue(daysAgo(15), "ok", 14, NOW)).toBe(true);
    expect(isDue(daysAgo(10), "none", 14, NOW)).toBe(false);
    expect(isDue(daysAgo(20), "unclear", 14, NOW)).toBe(true);
  });

  it("waits longer after a read that got nothing, by why it got nothing", () => {
    // Not tried again tomorrow...
    expect(isDue(daysAgo(1), "unreadable", 14, NOW)).toBe(false);
    expect(isDue(daysAgo(1), "blocked_robots", 14, NOW)).toBe(false);
    // ...a flaky connection is worth another go in a few days, a site that is only a picture in a month, a robots refusal in two.
    expect(isDue(daysAgo(4), "error", 14, NOW)).toBe(true);
    expect(isDue(daysAgo(20), "unreadable", 14, NOW)).toBe(false);
    expect(isDue(daysAgo(31), "unreadable", 14, NOW)).toBe(true);
    expect(isDue(daysAgo(45), "blocked_robots", 14, NOW)).toBe(false);
    expect(isDue(daysAgo(61), "blocked_robots", 14, NOW)).toBe(true);
  });

  it("keeps every failure wait at least as long as the transient-error wait", () => {
    for (const [status, days] of Object.entries(RETRY_DAYS)) if (status !== "error") expect(days).toBeGreaterThanOrEqual(RETRY_DAYS.error);
  });
});

describe("findMoreLinks", () => {
  const html = `
    <nav>
      <a href="/">Home</a>
      <a href="/cart">Cart 0</a>
      <a href="/menu">Menu</a>
      <a href="/happy-hour">Happy Hour</a>
      <a href="/drinks">Drinks</a>
      <a href="/merch">Merch</a>
      <a href="/s/BaitShop_Menu.pdf">Menu (PDF)</a>
      <a href="https://order.toasttab.com/online/x">Order online</a>
      <a href="/about">About us</a>
      <a href="/menu#top">Menu</a>
    </nav>`;

  it("lists the pages that look like a menu, happy hour first, then menu, then food and drinks", () => {
    expect(findMoreLinks(html, "https://bar.example/")).toEqual(["https://bar.example/happy-hour", "https://bar.example/menu", "https://bar.example/drinks"]);
  });
  it("skips carts, merch, PDFs (another finder takes those) and pages about the business", () => {
    const out = findMoreLinks(html, "https://bar.example/").join(" ");
    expect(out).not.toMatch(/cart|merch|\.pdf|about/);
  });
  it("gives nothing for a page with no such links", () => {
    expect(findMoreLinks('<a href="/hours">Hours</a>', "https://bar.example/")).toEqual([]);
  });
});
