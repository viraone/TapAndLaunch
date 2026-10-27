import type { PageEvent } from "seositetuneup";

/* Pure geometry and colour math for the crawl map. Everything here is a function of the pages, so it can be
 * tested without a DOM; the React component only measures the box and draws the numbers. */

export const MIN_NODE_R = 8; // smallest leaf dot
export const MAX_NODE_R = 14; // largest leaf dot, set by how many internal links the page has
export const HOME_RADIUS = 16; // the radar source is always the biggest
export const RING_GAP = 92; // abstract distance between depth rings
export const MAX_RADIUS = 460; // cap so a very deep site still fits the box
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°, spreads a ring without overlap

export const C_GOOD = "#34d399";
export const C_MID = "#fbbf24";
export const C_BAD = "#fb7185";
export const C_BLUE = "#60a5fa";

/** One crawled page on the map, before it is fitted to the box. */
export interface CrawlNode {
  url: string;
  path: string;
  from: string | null;
  depth: number;
  angle: number;
  pos: { x: number; y: number };
  r: number;
  status: number | null;
  score: number | null;
  ms: number | null;
  links: number;
  page: PageEvent;
}

export interface CrawlEdge {
  from: string;
  to: string;
}

export function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

export function truncateLabel(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
}

export function ringRadius(depth: number): number {
  return Math.min(MAX_RADIUS, depth * RING_GAP);
}

export function ringPosition(depth: number, angle: number): { x: number; y: number } {
  if (depth <= 0) return { x: 0, y: 0 };
  const radius = ringRadius(depth);
  return { x: Math.round(radius * Math.cos(angle)), y: Math.round(radius * Math.sin(angle)) };
}

export function nodeRadius(isHome: boolean, links: number): number {
  if (isHome) return HOME_RADIUS;
  return Math.min(MAX_NODE_R, MIN_NODE_R + Math.round(Math.sqrt(links)));
}

/**
 * The pages as map nodes, in the order they were crawled. The first page is the home (depth 0); every later page
 * sits one ring out from the page that discovered it, or one ring out when its parent is not there (sitemap roots).
 */
export function buildNodes(pages: PageEvent[]): CrawlNode[] {
  const nodes: CrawlNode[] = [];
  const byUrl = new Map<string, CrawlNode>();
  const depthCounters = new Map<number, number>();
  let home: string | null = null;

  for (const page of pages) {
    const isHome = home === null;
    if (isHome) home = page.url;

    let depth: number;
    let angle: number;
    if (isHome) {
      depth = 0;
      angle = 0;
    } else {
      const parent = page.from ? byUrl.get(page.from) : null;
      depth = parent ? parent.depth + 1 : 1;
      const n = depthCounters.get(depth) ?? 0;
      depthCounters.set(depth, n + 1);
      angle = n * GOLDEN_ANGLE;
    }

    const node: CrawlNode = {
      url: page.url,
      path: pathOf(page.url),
      from: page.from,
      depth,
      angle,
      pos: ringPosition(depth, angle),
      r: nodeRadius(isHome, page.facts.internalLinks.length),
      status: page.status,
      score: page.score.total,
      ms: page.ms,
      links: page.facts.internalLinks.length,
      page,
    };
    nodes.push(node);
    byUrl.set(page.url, node);
  }
  return nodes;
}

/** The discovery edges, one per (from, to) pair, in the order the pages were crawled. */
export function buildEdges(pages: PageEvent[]): CrawlEdge[] {
  const edges: CrawlEdge[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page.from) continue;
    const key = page.from + "\n" + page.url;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: page.from, to: page.url });
  }
  return edges;
}

export interface PositionedNode extends CrawlNode {
  x: number;
  y: number;
}

export interface GuideRing {
  depth: number;
  radius: number;
  label: string;
}

export interface Layout {
  scale: number;
  cx: number;
  cy: number;
  nodes: PositionedNode[];
  rings: GuideRing[];
  maxDepth: number;
}

/**
 * Fits the abstract ring layout into a box of `width` by `height`, centred on the home page so the depth rings stay
 * concentric. One scale for both axes, so the rings read as circles (a radar scope) not ellipses.
 */
export function layoutNodes(nodes: CrawlNode[], width: number, height: number, padX = 46, padY = 40): Layout {
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);

  let maxAbsX = 0;
  let maxAbsY = 0;
  let maxDepth = 0;
  for (const node of nodes) {
    maxAbsX = Math.max(maxAbsX, Math.abs(node.pos.x));
    maxAbsY = Math.max(maxAbsY, Math.abs(node.pos.y));
    maxDepth = Math.max(maxDepth, node.depth);
  }

  const scale = Math.min(maxAbsX ? innerW / (2 * maxAbsX) : 1, maxAbsY ? innerH / (2 * maxAbsY) : 1);
  const cx = width / 2;
  const cy = height / 2;
  const positioned: PositionedNode[] = nodes.map((node) => ({ ...node, x: cx + node.pos.x * scale, y: cy + node.pos.y * scale }));

  const rings: GuideRing[] = [];
  if (nodes.length > 0 && maxDepth > 0) {
    for (let d = 1; d <= maxDepth; d++) {
      rings.push({ depth: d, radius: ringRadius(d) * scale, label: d === 1 ? "1 click" : `${d} clicks` });
    }
  }

  return { scale, cx, cy, nodes: positioned, rings, maxDepth };
}

/** The curved path between two positioned nodes, bowed gently away from the centre. */
export function edgePath(a: { x: number; y: number }, b: { x: number; y: number }, cx: number, cy: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const vx = mx - cx;
  const vy = my - cy;
  const len = Math.hypot(vx, vy) || 1;
  const bow = 0.22 * Math.hypot(b.x - a.x, b.y - a.y);
  const qx = mx + (vx / len) * bow;
  const qy = my + (vy / len) * bow;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function nodeColor(score: number | null): string {
  if (score === null) return C_BLUE;
  if (score >= 90) return C_GOOD;
  if (score >= 70) return C_MID;
  return C_BAD;
}

/** The set of (from, to) edge keys on the path from `url` back to the home page, for lighting the path. */
export function pathToHome(url: string | null, nodes: CrawlNode[]): Set<string> {
  const byUrl = new Map(nodes.map((n) => [n.url, n]));
  const set = new Set<string>();
  let u = url;
  if (!u) return set;
  for (let guard = 0; guard < byUrl.size + 1; guard++) {
    const node = byUrl.get(u);
    if (!node || !node.from) break;
    set.add(node.from + "\n" + u);
    u = node.from;
  }
  return set;
}

/** The hover tooltip's second line: status · score · time. */
export function tooltipMeta(node: { status: number | null; score: number | null; ms: number | null }): string {
  const status = node.status === 0 ? "no answer" : "status " + node.status;
  const score = node.score === null ? "—" : String(node.score);
  const ms = typeof node.ms === "number" ? node.ms + " ms" : "";
  return [status, "score " + score, ms].filter(Boolean).join(" · ");
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where a chip label sits next to a node, kept inside the box. */
export function chipPosition(
  node: { x: number; y: number; r: number },
  width: number,
  height: number,
  chipW: number,
  chipH: number
): { left: number; top: number } {
  const onLeft = node.x < width / 2;
  let left = onLeft ? node.x + node.r + 8 : node.x - node.r - 8 - chipW;
  left = clamp(left, 6, width - chipW - 6);
  let top = node.y - chipH / 2;
  top = clamp(top, 6, height - chipH - 6);
  return { left, top };
}

/** Where the hover tooltip sits above (or below) a node, kept inside the box. */
export function tooltipPosition(
  node: { x: number; y: number; r: number },
  width: number,
  height: number,
  tipW: number,
  tipH: number
): { left: number; top: number } {
  let left = node.x - tipW / 2;
  left = clamp(left, 8, width - tipW - 8);
  let top = node.y - node.r - tipH - 10;
  if (top < 6) top = node.y + node.r + 10;
  top = clamp(top, 6, height - tipH - 6);
  return { left, top };
}

/** The chip's box, estimated from its label so it can be placed without measuring the DOM. */
export function chipSize(label: string): { w: number; h: number } {
  return { w: Math.max(40, Math.min(220, label.length * 6 + 18)), h: 20 };
}

/** The tooltip's box, estimated from its two lines. */
export function tooltipSize(path: string, meta: string): { w: number; h: number } {
  return { w: Math.max(120, Math.min(240, Math.max(path.length, meta.length) * 6 + 18)), h: 40 };
}
