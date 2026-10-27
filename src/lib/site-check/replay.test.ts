import { describe, expect, it } from "vitest";
import type { PageResult, Report } from "seositetuneup";
import { replayEvents } from "./replay";

function report(overrides: Partial<Report> = {}): Report {
  const page: PageResult = {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    status: 200,
    redirects: 0,
    timeMs: 123,
    bytes: 456,
    facts: {
      title: "Example",
      description: null,
      h1: [],
      canonical: null,
      wordCount: 10,
      internalLinks: [],
      externalLinkCount: 0,
      imageCount: 0,
    },
    findings: [{ id: "title-short", severity: "warning", message: "Title is short", fix: "Lengthen it" }],
    score: 96,
  };
  return {
    tool: "seo-audit",
    site: "https://example.com/",
    generatedAt: "2026-10-26T00:00:00.000Z",
    pages: [page],
    siteFindings: [{ id: "https", severity: "error", message: "No https", fix: "Use https", urls: ["https://example.com/"] }],
    score: 84,
    grade: "B",
    fixFirst: [{ id: "https", severity: "error", message: "No https", fix: "Use https", pageCount: 1, urls: ["https://example.com/"] }],
    ...overrides,
  };
}

describe("replayEvents", () => {
  it("replays start, pages, site findings, then the score tail and done", () => {
    const events = replayEvents(report(), "abc");
    expect(events.map((e) => e.type)).toEqual(["start", "page", "sitewide", "step", "step", "score", "step", "done"]);

    expect(events[0]).toMatchObject({ type: "start", site: "https://example.com/", maxPages: 15 });

    expect(events[1]).toMatchObject({
      type: "page",
      url: "https://example.com/",
      from: null,
      ms: 123,
      score: {
        start: 100,
        deductions: [{ id: "title-short", severity: "warning", points: 4, message: "Title is short" }],
        total: 96,
      },
    });

    expect(events[2]).toMatchObject({ type: "sitewide", points: 12 });

    // Every step in a replay is already done.
    expect(events[3]).toEqual({ type: "step", stage: "speed", state: "done", note: "Skipped: not measured in the quick check." });
    expect(events[4]).toEqual({ type: "step", stage: "score", state: "done", note: "Building the final score." });
    expect(events[5]).toMatchObject({ type: "score", score: 84, grade: "B" });
    expect(events[6]).toEqual({ type: "step", stage: "score", state: "done", note: "Score 84/100 (B)." });

    expect(events[7]).toMatchObject({
      type: "done",
      id: "abc",
      score: 84,
      grade: "B",
      reportUrl: "/api/site-check/abc/report",
      unreadable: null,
    });
    const done = events[7] as { fixFirst: Array<{ id: string; severity: string; pageCount: number }> };
    expect(done.fixFirst).toHaveLength(1);
    expect(done.fixFirst[0]).toMatchObject({ id: "https", severity: "error", pageCount: 1 });
  });

  it("replays the uncheckable tail with no score event", () => {
    const events = replayEvents(
      report({ score: null, grade: null, unreadable: { reason: "unreachable", message: "No answer" } }),
      "x"
    );
    expect(events.map((e) => e.type)).toEqual(["start", "page", "sitewide", "step", "step", "done"]);
    expect(events[3]).toEqual({ type: "step", stage: "speed", state: "done", note: "Skipped: the site could not be checked." });
    expect(events[4]).toEqual({ type: "step", stage: "score", state: "done", note: "Skipped: no score for a site that could not be checked." });
  });
});
