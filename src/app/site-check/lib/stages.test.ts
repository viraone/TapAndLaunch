import { describe, expect, it } from "vitest";
import { FINDING_LABELS, findingLabel, scoreRows, type PageScoreBreakdown } from "./stages";

describe("findingLabel", () => {
  it("returns the known short label", () => {
    expect(findingLabel("title-missing")).toBe("No title");
    expect(findingLabel("robots-missing")).toBe("No robots.txt");
  });

  it("turns an unknown id into its dashed words, capitalised", () => {
    expect(findingLabel("some-new-check")).toBe("Some new check");
  });

  it("covers every page check the reference documents", () => {
    for (const id of ["http-5xx", "not-https", "title-short", "description-long", "img-alt-missing", "script-built"]) {
      expect(FINDING_LABELS[id]).toBeTruthy();
    }
  });
});

describe("scoreRows", () => {
  const score: PageScoreBreakdown = {
    start: 100,
    deductions: [
      { id: "title-short", severity: "warning", points: 4, message: "Title is short" },
      { id: "not-https", severity: "error", points: 12, message: "Not HTTPS" },
    ],
    total: 84,
  };

  it("starts at 100, lists each problem with its cost and short label, then the total", () => {
    expect(scoreRows(score)).toEqual([
      { kind: "start", label: "Start", points: "100" },
      { kind: "problem", label: "Title too short", points: "−4", severity: "warning", message: "Title is short" },
      { kind: "problem", label: "Not HTTPS", points: "−12", severity: "error", message: "Not HTTPS" },
      { kind: "total", label: "Page score", points: "84" },
    ]);
  });

  it("returns just start and total for a clean page", () => {
    expect(scoreRows({ start: 100, deductions: [], total: 100 })).toEqual([
      { kind: "start", label: "Start", points: "100" },
      { kind: "total", label: "Page score", points: "100" },
    ]);
  });
});
