import { DESCRIPTION_LIMITS, PUBLIC_LIMITS, SEVERITY_POINTS, TITLE_LIMITS } from "seositetuneup";
import type { Finding, PageEvent, PageResult, Report, SitewideEvent, StartEvent, StepEvent } from "seositetuneup";
import { doneEvent, scoreEvent, type SiteCheckDoneEvent, type SiteCheckScoreEvent } from "./finish";

type Severity = Finding["severity"];
type SiteFinding = Report["siteFindings"][number];

interface ReplayPageScore {
  start: number;
  deductions: Array<{ id: string; severity: Severity; points: number; message: string }>;
  total: number;
}

/** The same math as the engine's own pageScoreBreakdown, rebuilt here because it is not exported. */
function pageScoreBreakdown(findings: Finding[]): ReplayPageScore {
  const seen = new Set<string>();
  const deductions: ReplayPageScore["deductions"] = [];
  let total = 100;
  for (const f of findings) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const points = SEVERITY_POINTS[f.severity];
    deductions.push({ id: f.id, severity: f.severity, points, message: f.message });
    total -= points;
  }
  return { start: 100, deductions, total: Math.max(0, total) };
}

function pageEvent(p: PageResult): PageEvent {
  return {
    type: "page",
    url: p.url,
    finalUrl: p.finalUrl,
    from: null,
    status: p.status,
    ms: p.timeMs,
    bytes: p.bytes,
    facts: p.facts,
    findings: p.findings,
    score: pageScoreBreakdown(p.findings),
  };
}

function sitewideEvent(f: SiteFinding): SitewideEvent {
  return { type: "sitewide", finding: f, points: SEVERITY_POINTS[f.severity] };
}

export type ReplayEvent = StartEvent | PageEvent | SitewideEvent | StepEvent | SiteCheckScoreEvent | SiteCheckDoneEvent;

/**
 * The events a replay of a finished run sends: `start`, each stored page, each site-wide finding, then the score steps, score and
 * `done`. A live run's request/file/queue events are not stored, so they are not replayed, and every step is already "done".
 */
export function replayEvents(report: Report, id: string): ReplayEvent[] {
  const events: ReplayEvent[] = [];

  events.push({
    type: "start",
    site: report.site,
    maxPages: report.limits?.maxPages ?? PUBLIC_LIMITS.maxPages,
    gapMs: PUBLIC_LIMITS.delayMs ?? 0,
    local: report.local?.enabled ?? false,
    titleLimits: TITLE_LIMITS,
    descriptionLimits: DESCRIPTION_LIMITS,
  });

  for (const p of report.pages) events.push(pageEvent(p));
  for (const f of report.siteFindings) events.push(sitewideEvent(f));

  if (report.score !== null && !report.unreadable) {
    events.push({ type: "step", stage: "speed", state: "done", note: "Skipped: not measured in the quick check." });
    events.push({ type: "step", stage: "score", state: "done", note: "Building the final score." });
    const s = scoreEvent(report);
    events.push(s);
    events.push({ type: "step", stage: "score", state: "done", note: `Score ${s.score}/100 (${s.grade}).` });
  } else {
    events.push({ type: "step", stage: "speed", state: "done", note: "Skipped: the site could not be checked." });
    events.push({ type: "step", stage: "score", state: "done", note: "Skipped: no score for a site that could not be checked." });
  }

  events.push(doneEvent(report, id));
  return events;
}
