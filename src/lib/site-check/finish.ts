import { grade, plainFix, scoreBreakdown, topFive } from "seositetuneup";
import type { DoneFix, Report, ScoreBreakdown, Unreadable } from "seositetuneup";

/** The `score` event the route sends after the crawl, so the numbers match the report exactly. */
export interface SiteCheckScoreEvent extends ScoreBreakdown {
  type: "score";
  grade: string;
}

/** The `done` event the route sends, naming the saved report. (The engine's own `DoneEvent` names `reportId`; ours carries the id and a reportUrl.) */
export interface SiteCheckDoneEvent {
  type: "done";
  id: string | null;
  score: number | null;
  grade: string | null;
  fixFirst: DoneFix[];
  unreadable: Unreadable | null;
  reportUrl: string | null;
}

/** The fix-first list in plain words, trimmed to the five things to do first, exactly as the visual UI's done event builds it. */
export function doneFixFirst(report: Report): DoneFix[] {
  return topFive(report.fixFirst).map((f) => {
    const p = plainFix(f, report.builder?.id);
    return { id: f.id, severity: f.severity, what: p.what, why: p.why, how: p.how, pageCount: f.pageCount };
  });
}

/** The score event built from the same numbers the report shows. */
export function scoreEvent(report: Report): SiteCheckScoreEvent {
  const b = scoreBreakdown(report.pages, report.siteFindings);
  return { type: "score", pagesCounted: b.pagesCounted, average: b.average, penalties: b.penalties, score: b.score, grade: grade(b.score) };
}

export function doneEvent(report: Report, id: string | null): SiteCheckDoneEvent {
  return {
    type: "done",
    id,
    score: report.score,
    grade: report.grade,
    fixFirst: doneFixFirst(report),
    unreadable: report.unreadable ?? null,
    reportUrl: id ? `/api/site-check/${id}/report` : null,
  };
}
