import type {
  BrokenEvent,
  DoneFix,
  ErrorEvent,
  FileEvent,
  OutsideDeadEvent,
  PageEvent,
  QueueEvent,
  RequestEvent,
  ScoreEvent,
  SitewideEvent,
  Stage,
  StartEvent,
  StepEvent,
  Unreadable,
} from "seositetuneup";
import { buildEdges, buildNodes, type CrawlEdge, type CrawlNode } from "./radar";
import { STAGES } from "./stages";

/** The first event of a replayed (cached) run: the saved report's timestamp, carried on the SSE event name. */
export interface CachedEvent {
  type: "cached";
  checkedAt: string;
}

/** The `done` event this route sends (unlike the engine's own, it names `id` and `reportUrl`, not `reportId`). */
export interface SiteCheckDoneEvent {
  type: "done";
  id: string | null;
  score: number | null;
  grade: string | null;
  fixFirst: DoneFix[];
  unreadable: Unreadable | null;
  reportUrl: string | null;
}

/** One event the stream can carry. */
export type StreamEvent =
  | StartEvent
  | StepEvent
  | RequestEvent
  | FileEvent
  | PageEvent
  | QueueEvent
  | BrokenEvent
  | OutsideDeadEvent
  | SitewideEvent
  | ScoreEvent
  | SiteCheckDoneEvent
  | ErrorEvent
  | CachedEvent;

/** A stream event, or a local action (selecting a map node, starting over, a route-level refusal). */
export type ReduceEvent =
  | StreamEvent
  | { type: "select"; url: string | null }
  | { type: "reset" }
  | { type: "blocked"; message: string };

export type StageState = "waiting" | "running" | "done" | "skip";
export type Phase = "idle" | "running" | "done" | "stopped";

export interface LogLine {
  status: "ok" | "warn" | "err";
  text: string;
  ms?: number;
  at: number;
}

export interface SiteCheckState {
  phase: Phase;
  site: string | null;
  maxPages: number;
  gapMs: number;
  titleLimits: { min: number; max: number };
  descriptionLimits: { min: number; max: number };
  stages: Record<Stage, { state: StageState; note: string }>;
  crawl: { discovered: number; queued: number; crawled: number; limit: number };
  nodes: CrawlNode[];
  edges: CrawlEdge[];
  pages: PageEvent[];
  selectedUrl: string | null;
  userSelected: boolean;
  log: LogLine[];
  score: ScoreEvent | null;
  done: SiteCheckDoneEvent | null;
  cachedMinutesAgo: number | null;
  routeError: string | null;
  runError: string | null;
}

export function initialState(): SiteCheckState {
  const stages = {} as Record<Stage, { state: StageState; note: string }>;
  for (const s of STAGES) stages[s.id] = { state: "waiting", note: "" };
  return {
    phase: "idle",
    site: null,
    maxPages: 0,
    gapMs: 0,
    titleLimits: { min: 30, max: 60 },
    descriptionLimits: { min: 70, max: 160 },
    stages,
    crawl: { discovered: 0, queued: 0, crawled: 0, limit: 0 },
    nodes: [],
    edges: [],
    pages: [],
    selectedUrl: null,
    userSelected: false,
    log: [],
    score: null,
    done: null,
    cachedMinutesAgo: null,
    routeError: null,
    runError: null,
  };
}

function requestStatus(status: number): LogLine["status"] {
  return status === 0 || status >= 400 ? "err" : status >= 300 ? "warn" : "ok";
}

/**
 * Turns one stream event (or local action) into the next panel state. Pure apart from the `now` timestamps on log
 * lines and the cached "minutes ago", which are passed in so tests stay deterministic.
 */
export function reduce(state: SiteCheckState, event: ReduceEvent, now = Date.now()): SiteCheckState {
  switch (event.type) {
    case "reset":
      return initialState();

    case "blocked":
      return { ...initialState(), routeError: event.message };

    case "select":
      return { ...state, selectedUrl: event.url, userSelected: event.url !== null };

    case "cached": {
      const minutes = Math.max(0, Math.round((now - Date.parse(event.checkedAt)) / 60_000));
      return { ...state, cachedMinutesAgo: minutes };
    }

    case "start":
      return {
        ...state,
        phase: "running",
        site: event.site,
        maxPages: event.maxPages,
        gapMs: event.gapMs,
        titleLimits: event.titleLimits,
        descriptionLimits: event.descriptionLimits,
        crawl: { ...state.crawl, limit: event.maxPages },
      };

    case "step": {
      const stageState: StageState = event.state === "start" ? "running" : event.state;
      return {
        ...state,
        stages: { ...state.stages, [event.stage]: { state: stageState, note: event.note ?? state.stages[event.stage].note } },
      };
    }

    case "request":
      return {
        ...state,
        log: [
          ...state.log,
          { status: requestStatus(event.status), text: `${event.method} ${event.url} → ${event.status === 0 ? "no answer" : event.status}`, ms: event.ms, at: now },
        ],
      };

    case "file": {
      const status: LogLine["status"] = event.status >= 400 ? "err" : "ok";
      const kind = event.kind === "robots" ? "robots.txt" : "sitemap.xml";
      const note = `${event.kind === "robots" ? "robots.txt" : "sitemap"}: ${event.summary}`;
      return {
        ...state,
        log: [...state.log, { status, text: `${kind} → ${event.status} · ${event.summary}`, at: now }],
        stages: { ...state.stages, robots: { ...state.stages.robots, note } },
      };
    }

    case "page": {
      const pages = [...state.pages, event];
      // The checked panel follows the latest crawled page until the visitor picks one on the map.
      const selectedUrl = state.userSelected ? state.selectedUrl : event.url;
      return { ...state, pages, nodes: buildNodes(pages), edges: buildEdges(pages), selectedUrl };
    }

    case "queue":
      return { ...state, crawl: { discovered: event.discovered, queued: event.queued, crawled: event.crawled, limit: event.limit } };

    case "broken":
      return { ...state, log: [...state.log, { status: "warn", text: `broken ${event.from} → ${event.to} (${event.status})`, at: now }] };

    case "outside-dead":
      return { ...state, log: [...state.log, { status: "warn", text: `outside dead ${event.from} → ${event.to} (${event.status})`, at: now }] };

    case "sitewide":
      return { ...state, log: [...state.log, { status: "warn", text: `site-wide −${event.points} · ${event.finding.message}`, at: now }] };

    case "score":
      return { ...state, score: event };

    case "done":
      return { ...state, phase: "done", done: event };

    case "error":
      return { ...state, phase: "stopped", runError: event.message };

    default:
      return state;
  }
}

/** The crawl counter line. Queue events are the live source; a replay has none, so it falls back to the pages. */
export function counterLabel(state: { crawl: { crawled: number; queued: number; limit: number }; pages: unknown[]; maxPages: number }): string {
  const crawled = state.crawl.crawled || state.pages.length;
  const queued = state.crawl.queued;
  const limit = state.crawl.limit || state.maxPages;
  return `${crawled} crawled · ${queued} queued · limit ${limit || "—"}`;
}
