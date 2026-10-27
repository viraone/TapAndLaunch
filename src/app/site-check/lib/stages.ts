import type { Stage } from "seositetuneup";

/** The engine's page-score math, spelled out locally because the package does not re-export this type. */
export interface PageScoreBreakdown {
  start: number;
  deductions: Array<{ id: string; severity: string; points: number; message: string }>;
  total: number;
}

/** The eight stages of an audit, in the order they run, with the one-sentence plain explanation shown under each name. */
export const STAGES: Array<{ id: Stage; name: string; why: string }> = [
  { id: "robots", name: "Read robots.txt and sitemap", why: "See what the site asks crawlers to do, and which pages it lists." },
  { id: "crawl", name: "Crawl the pages", why: "Visit pages and follow same-site links, up to the limit." },
  { id: "links", name: "Check internal links", why: "Find links between the site's own pages that are broken." },
  { id: "external", name: "Check links to other sites", why: "Find links to other sites that now lead nowhere." },
  { id: "addresses", name: "Check http/https and www", why: "Make sure both spellings of the site work." },
  { id: "sitewide", name: "Site-wide checks", why: "Look for problems that span the whole site." },
  { id: "speed", name: "Measure page speed", why: "Google PageSpeed, when a key is set up." },
  { id: "score", name: "Build the score", why: "Average the pages, then subtract the site-wide problems." },
];

/** Points each severity costs: error 12, warning 4, notice 1. */
export const POINTS: Record<string, number> = { error: 12, warning: 4, info: 1 };

/* Short names for the score table, keyed by the finding ids in the engine's page and site checks.
 * Unknown ids fall back to the id with its dashes turned into spaces, so a new check still reads sensibly. */
export const FINDING_LABELS: Record<string, string> = {
  // Page checks
  "http-5xx": "Server error",
  "http-4xx": "Page not found",
  "redirect-chain": "Redirect chain",
  "not-https": "Not HTTPS",
  "slow-response": "Slow response",
  "heavy-html": "Heavy HTML",
  "title-missing": "No title",
  "title-short": "Title too short",
  "title-long": "Title too long",
  "description-missing": "No meta description",
  "description-short": "Description too short",
  "description-long": "Description too long",
  "h1-missing": "No main heading",
  "h1-multiple": "Several main headings",
  "heading-skip": "Heading level skipped",
  "canonical-missing": "No canonical",
  "canonical-relative": "Canonical not a full address",
  "noindex": "Noindex set",
  "lang-missing": "No page language",
  "viewport-missing": "No mobile viewport",
  "favicon-missing": "No favicon",
  "og-title-missing": "No share title",
  "og-description-missing": "No share description",
  "og-image-missing": "No share picture",
  "twitter-card-missing": "No Twitter card",
  "jsonld-missing": "No structured data",
  "jsonld-invalid": "Broken structured data",
  "img-alt-missing": "Images lack alt text",
  "img-size-missing": "Images lack size",
  "link-text-missing": "Links lack text",
  "mixed-content": "Mixed http content",
  "script-built": "Built by scripts",
  "thin-content": "Thin content",
  // Site-wide checks
  "robots-missing": "No robots.txt",
  "robots-blocks-all": "robots.txt blocks all",
  "robots-no-sitemap": "No sitemap in robots.txt",
  "sitemap-missing": "No sitemap",
  "sitemap-empty": "Empty sitemap",
  "sitemap-incomplete": "Pages not in sitemap",
  "title-duplicate": "Duplicate titles",
  "description-duplicate": "Duplicate descriptions",
  "links-broken": "Broken links",
  "http-not-redirected": "HTTP not redirected",
  "www-duplicate": "Duplicate www",
  "links-broken-external": "Dead outside links",
};

/** A short, plain label for a finding id; ids without an entry read as their dashed words. */
export function findingLabel(id: string): string {
  const known = FINDING_LABELS[id];
  if (typeof known === "string") return known;
  const words = String(id).replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface ScoreRow {
  kind: "start" | "problem" | "total";
  label: string;
  points: string;
  severity?: string;
  message?: string;
}

/** The page score as the small table: "Start", one row per problem, then "Page score". */
export function scoreRows(score: PageScoreBreakdown): ScoreRow[] {
  const rows: ScoreRow[] = [{ kind: "start", label: "Start", points: String(score.start) }];
  for (const d of score.deductions) {
    rows.push({ kind: "problem", label: findingLabel(d.id), points: `−${d.points}`, severity: d.severity, message: d.message });
  }
  rows.push({ kind: "total", label: "Page score", points: String(score.total) });
  return rows;
}

/** The severity pill on a fix or finding, in the site's light-theme colours. */
export function severityBadge(severity: string): string {
  if (severity === "error") return "rounded-[10px] bg-red-500/15 px-1.5 py-0.5 text-[0.72rem] font-bold uppercase text-red-600";
  if (severity === "warning") return "rounded-[10px] bg-amber-500/15 px-1.5 py-0.5 text-[0.72rem] font-bold uppercase text-amber-600";
  return "rounded-[10px] bg-neutral-500/15 px-1.5 py-0.5 text-[0.72rem] font-bold uppercase text-neutral-500";
}

/** The little severity dot in the score table. */
export function severityDot(severity: string): string {
  if (severity === "error") return "bg-red-500";
  if (severity === "warning") return "bg-amber-500";
  return "bg-neutral-400";
}
