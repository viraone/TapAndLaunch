import { describe, expect, it } from "vitest";
import type { PageEvent } from "seositetuneup";
import {
  GOLDEN_ANGLE,
  HOME_RADIUS,
  buildNodes,
  chipPosition,
  edgePath,
  layoutNodes,
  nodeColor,
  nodeRadius,
  pathToHome,
  ringPosition,
  tooltipPosition,
  truncateLabel,
} from "./radar";

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

describe("truncateLabel", () => {
  it("keeps short labels and truncates long ones with an ellipsis", () => {
    expect(truncateLabel("short", 20)).toBe("short");
    expect(truncateLabel("a very long path that goes on", 10)).toBe("a very lo…");
  });
});

describe("nodeColor", () => {
  it("is blue before a page is scored", () => {
    expect(nodeColor(null)).toBe("#60a5fa");
  });

  it("is green at 90+, amber at 70+, red below", () => {
    expect(nodeColor(90)).toBe("#34d399");
    expect(nodeColor(70)).toBe("#fbbf24");
    expect(nodeColor(69)).toBe("#fb7185");
  });
});

describe("nodeRadius", () => {
  it("keeps the home page the biggest", () => {
    expect(nodeRadius(true, 100)).toBe(HOME_RADIUS);
  });

  it("sizes a leaf by its internal-link count, capped", () => {
    expect(nodeRadius(false, 0)).toBe(8);
    expect(nodeRadius(false, 4)).toBe(10);
    expect(nodeRadius(false, 1000)).toBe(14);
  });
});

describe("buildNodes", () => {
  it("makes the first page the home at the centre, then places children one ring out", () => {
    const home = page("https://x.com/", null);
    const child = page("https://x.com/about", "https://x.com/");
    const grandchild = page("https://x.com/about/team", "https://x.com/about");
    const secondChild = page("https://x.com/blog", "https://x.com/");
    const nodes = buildNodes([home, child, grandchild, secondChild]);

    expect(nodes.map((n) => n.path)).toEqual(["/", "/about", "/about/team", "/blog"]);

    expect(nodes[0]).toMatchObject({ depth: 0, angle: 0, pos: { x: 0, y: 0 }, r: HOME_RADIUS });
    expect(nodes[1].depth).toBe(1);
    expect(nodes[1].angle).toBe(0); // first page on the ring sits at angle 0
    expect(nodes[1].pos).toEqual(ringPosition(1, 0));
    expect(nodes[2].depth).toBe(2);
    expect(nodes[2].angle).toBe(0);
    expect(nodes[3].depth).toBe(1);
    expect(nodes[3].angle).toBeCloseTo(GOLDEN_ANGLE); // the second page on the same ring spreads out
  });

  it("reads a page with a missing parent as one click deep", () => {
    const nodes = buildNodes([page("https://x.com/", null), page("https://x.com/orphan", "https://x.com/never-crawled")]);
    expect(nodes[1].depth).toBe(1);
  });
});

describe("layoutNodes", () => {
  it("centres the home node and keeps a single node at the middle", () => {
    const layout = layoutNodes(buildNodes([page("https://x.com/", null)]), 640, 360);
    expect(layout.nodes[0].x).toBeCloseTo(320);
    expect(layout.nodes[0].y).toBeCloseTo(180);
  });

  it("emits one guide ring per depth level, labelled in clicks", () => {
    const nodes = buildNodes([page("https://x.com/", null), page("https://x.com/a", "https://x.com/"), page("https://x.com/a/b", "https://x.com/a")]);
    const layout = layoutNodes(nodes, 640, 360);
    expect(layout.maxDepth).toBe(2);
    expect(layout.rings.map((r) => r.label)).toEqual(["1 click", "2 clicks"]);
  });
});

describe("edgePath", () => {
  it("draws a quadratic curve through the midpoint", () => {
    const d = edgePath({ x: 0, y: 0 }, { x: 100, y: 0 }, 50, 0);
    expect(d.startsWith("M 0.0 0.0 Q")).toBe(true);
    expect(d).toContain("100.0 0.0");
  });
});

describe("pathToHome", () => {
  it("lights the edges on the path from the selected page back to home", () => {
    const nodes = buildNodes([page("https://x.com/", null), page("https://x.com/a", "https://x.com/"), page("https://x.com/a/b", "https://x.com/a")]);
    const set = pathToHome("https://x.com/a/b", nodes);
    expect(set.has("https://x.com/a\nhttps://x.com/a/b")).toBe(true);
    expect(set.has("https://x.com/\nhttps://x.com/a")).toBe(true);
  });

  it("is empty for the home page or a missing url", () => {
    const nodes = buildNodes([page("https://x.com/", null)]);
    expect(pathToHome("https://x.com/", nodes).size).toBe(0);
    expect(pathToHome("https://x.com/nope", nodes).size).toBe(0);
  });
});

describe("chipPosition and tooltipPosition", () => {
  it("places a chip to the right of a node on the left half, and clamps inside the box", () => {
    const pos = chipPosition({ x: 200, y: 180, r: 16 }, 640, 360, 60, 20);
    expect(pos.left).toBe(224); // node.x + node.r + 8, on the node's right
    expect(pos.top).toBe(170);
  });

  it("keeps a tooltip above a node and inside the box", () => {
    const pos = tooltipPosition({ x: 320, y: 180, r: 16 }, 640, 360, 140, 40);
    expect(pos.top).toBeLessThan(180);
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left).toBeLessThanOrEqual(640 - 140 - 8);
  });
});
