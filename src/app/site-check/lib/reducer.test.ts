import { describe, expect, it } from "vitest";
import type { PageEvent, StartEvent } from "seositetuneup";
import { counterLabel, initialState, reduce } from "./reducer";

const NOW = Date.parse("2026-10-26T12:00:00Z");

function start(site = "https://x.com/"): StartEvent {
  return {
    type: "start",
    site,
    maxPages: 15,
    gapMs: 250,
    local: false,
    titleLimits: { min: 30, max: 60 },
    descriptionLimits: { min: 70, max: 160 },
  };
}

function page(url: string, from: string | null, score = 100, links = 0): PageEvent {
  return {
    type: "page",
    url,
    finalUrl: url,
    from,
    status: 200,
    ms: 50,
    bytes: 1000,
    facts: {
      title: "T",
      description: null,
      h1: [],
      canonical: null,
      wordCount: 10,
      internalLinks: new Array(links).fill(0).map((_, i) => `${url}/l${i}`),
      externalLinkCount: 0,
      imageCount: 0,
    },
    findings: [],
    score: { start: 100, deductions: [], total: score },
  };
}

describe("reduce", () => {
  it("starts the run and sets the limits", () => {
    const s = reduce(initialState(), start(), NOW);
    expect(s.phase).toBe("running");
    expect(s.site).toBe("https://x.com/");
    expect(s.maxPages).toBe(15);
    expect(s.titleLimits).toEqual({ min: 30, max: 60 });
    expect(s.crawl.limit).toBe(15);
  });

  it("maps a step start to running, and keeps the note on done", () => {
    let s = reduce(initialState(), { type: "step", stage: "crawl", state: "start", note: "Crawling" }, NOW);
    expect(s.stages.crawl).toEqual({ state: "running", note: "Crawling" });
    s = reduce(s, { type: "step", stage: "crawl", state: "done", note: "Crawled 3 pages" }, NOW);
    expect(s.stages.crawl).toEqual({ state: "done", note: "Crawled 3 pages" });
  });

  it("follows the latest page by default, and a click locks the selection", () => {
    let s = reduce(initialState(), page("https://x.com/", null), NOW);
    expect(s.selectedUrl).toBe("https://x.com/");
    s = reduce(s, page("https://x.com/a", "https://x.com/"), NOW);
    expect(s.selectedUrl).toBe("https://x.com/a");

    s = reduce(s, { type: "select", url: "https://x.com/" }, NOW);
    expect(s.userSelected).toBe(true);
    s = reduce(s, page("https://x.com/b", "https://x.com/a"), NOW);
    expect(s.selectedUrl).toBe("https://x.com/"); // the visitor's pick, not the new page
  });

  it("records the crawl counters from a queue event", () => {
    const s = reduce(initialState(), { type: "queue", discovered: 6, queued: 3, crawled: 2, limit: 15 }, NOW);
    expect(s.crawl).toEqual({ discovered: 6, queued: 3, crawled: 2, limit: 15 });
  });

  it("sorts request log lines by status", () => {
    const s = reduce(
      reduce(reduce(reduce(initialState(), { type: "request", n: 1, method: "GET", url: "https://x.com/", status: 200, ms: 10, bytes: 1 }, NOW), { type: "request", n: 2, method: "GET", url: "https://x.com/404", status: 404, ms: 11, bytes: 1 }, NOW), { type: "request", n: 3, method: "GET", url: "https://x.com/r", status: 301, ms: 12, bytes: 1 }, NOW), { type: "request", n: 4, method: "GET", url: "https://x.com/down", status: 0, ms: 13, bytes: 0 }, NOW
    );
    expect(s.log.map((l) => l.status)).toEqual(["ok", "err", "warn", "err"]);
    expect(s.log[3].text).toBe("GET https://x.com/down → no answer");
  });

  it("computes the cached minutes-ago from the checkedAt timestamp", () => {
    const s = reduce(initialState(), { type: "cached", checkedAt: "2026-10-26T11:55:00Z" }, NOW);
    expect(s.cachedMinutesAgo).toBe(5);
  });

  it("finishes on done and stops on error", () => {
    const done = { type: "done", id: "abc", score: 84, grade: "B", fixFirst: [], unreadable: null, reportUrl: "/api/site-check/abc/report" };
    const s = reduce(initialState(), done as never, NOW);
    expect(s.phase).toBe("done");
    expect(s.done?.reportUrl).toBe("/api/site-check/abc/report");

    const stopped = reduce(initialState(), { type: "error", message: "boom" }, NOW);
    expect(stopped.phase).toBe("stopped");
    expect(stopped.runError).toBe("boom");
  });

  it("clears everything and records the message when the route refuses", () => {
    const s = reduce(reduce(initialState(), start(), NOW), { type: "blocked", message: "Too many" }, NOW);
    expect(s.routeError).toBe("Too many");
    expect(s.phase).toBe("idle");
    expect(s.site).toBeNull();
  });
});

describe("counterLabel", () => {
  it("uses the queue counters when they have reported a crawl", () => {
    expect(counterLabel({ crawl: { crawled: 2, queued: 3, limit: 15 }, pages: [1], maxPages: 15 })).toBe("2 crawled · 3 queued · limit 15");
  });

  it("falls back to the page count for a replayed run with no queue events", () => {
    expect(counterLabel({ crawl: { crawled: 0, queued: 0, limit: 0 }, pages: [1, 2, 3], maxPages: 15 })).toBe("3 crawled · 0 queued · limit 15");
  });

  it("shows a dash for the limit before a start event", () => {
    expect(counterLabel({ crawl: { crawled: 0, queued: 0, limit: 0 }, pages: [], maxPages: 0 })).toBe("0 crawled · 0 queued · limit —");
  });
});
