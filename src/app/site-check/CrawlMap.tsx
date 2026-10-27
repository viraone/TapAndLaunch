"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  chipPosition,
  chipSize,
  edgePath,
  layoutNodes,
  nodeColor,
  pathToHome,
  tooltipMeta,
  tooltipPosition,
  tooltipSize,
  truncateLabel,
  type CrawlEdge,
  type CrawlNode,
  type PositionedNode,
} from "./lib/radar";

/* The dark glass surface: deep navy-black with a soft radial glow and a faint dot grid, in both page themes. */
const SURFACE: CSSProperties = {
  backgroundColor: "#0b1020",
  backgroundImage:
    "radial-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1.5px), radial-gradient(120% 100% at 50% 40%, #17254a 0%, #111a33 55%, #0b1020 100%)",
  backgroundSize: "22px 22px, 100% 100%",
  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.07)",
};

const LEGEND = [
  { className: "bg-[#34d399]", label: "90+" },
  { className: "bg-[#fbbf24]", label: "70 to 89" },
  { className: "bg-[#fb7185]", label: "below 70" },
];

/** The dark "radar" crawl map, drawn as SVG. It owns its layout maths and re-fits when the box is resized. */
export function CrawlMap({
  nodes,
  edges,
  selectedUrl,
  onSelect,
  counter,
}: {
  nodes: CrawlNode[];
  edges: CrawlEdge[];
  selectedUrl: string | null;
  onSelect: (url: string) => void;
  counter: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ width: 640, height: 360 });
  const [hoverUrl, setHoverUrl] = useState<string | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const width = Math.round(svg.clientWidth) || 640;
      const height = Math.round(svg.clientHeight) || 360;
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const layout = layoutNodes(nodes, box.width, box.height);
  const byUrl = new Map(layout.nodes.map((n) => [n.url, n]));
  const home = layout.nodes.find((n) => n.depth === 0) ?? layout.nodes[0] ?? null;
  const lit = selectedUrl ? pathToHome(selectedUrl, nodes) : null;

  const shown = new Map<string, PositionedNode>();
  if (home) shown.set(home.url, home);
  const sel = selectedUrl ? byUrl.get(selectedUrl) : null;
  if (sel) shown.set(sel.url, sel);
  const hover = hoverUrl ? byUrl.get(hoverUrl) : null;
  if (hover) shown.set(hover.url, hover);

  return (
    <div>
      <p className="mb-2 text-sm text-neutral-500">{counter}</p>
      <div className="relative overflow-hidden rounded-xl" style={SURFACE}>
        <svg ref={svgRef} viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-label="Map of the crawled pages" className="block h-[360px] w-full min-[1200px]:h-[420px]">
          <defs>
            {edges.map((edge, i) => {
              const a = byUrl.get(edge.from);
              const b = byUrl.get(edge.to);
              if (!a || !b) return null;
              return (
                <linearGradient key={i} id={`sc-eg-${i}`} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
                  <stop offset="0%" stopColor={nodeColor(a.score)} />
                  <stop offset="100%" stopColor={nodeColor(b.score)} />
                </linearGradient>
              );
            })}
          </defs>

          <g aria-hidden="true">
            {layout.rings.map((ring) => (
              <circle key={ring.depth} className="sc-guide-ring" cx={layout.cx} cy={layout.cy} r={ring.radius} />
            ))}
            {layout.rings.map((ring) => (
              <text key={ring.depth} className="sc-guide-label" x={layout.cx} y={layout.cy - ring.radius - 4} textAnchor="middle">
                {ring.label}
              </text>
            ))}
          </g>

          {home && (
            <g aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <circle key={i} className="sc-pulse-ring" cx={home.x} cy={home.y} r={home.r} />
              ))}
            </g>
          )}

          <g aria-hidden="true">
            {edges.map((edge, i) => {
              const a = byUrl.get(edge.from);
              const b = byUrl.get(edge.to);
              if (!a || !b) return null;
              const d = edgePath(a, b, layout.cx, layout.cy);
              const key = edge.from + "\n" + edge.to;
              const onPath = lit ? lit.has(key) : false;
              const className = lit ? (onPath ? "sc-edge lit" : "sc-edge dim") : "sc-edge";
              return (
                <g key={i} className={className}>
                  <path className="sc-edge-stroke" d={d} stroke={`url(#sc-eg-${i})`} />
                </g>
              );
            })}
          </g>

          <g>
            {layout.nodes.map((node) => {
              const parent = node.from ? byUrl.get(node.from) : null;
              const dx = (parent ? parent.x : node.x) - node.x;
              const dy = (parent ? parent.y : node.y) - node.y;
              const style = { "--nc": nodeColor(node.score), "--dx": `${dx.toFixed(1)}px`, "--dy": `${dy.toFixed(1)}px` } as CSSProperties;
              const isSelected = node.url === selectedUrl;
              return (
                <g
                  key={node.url}
                  className={`sc-node${isSelected ? " selected" : ""}`}
                  style={style}
                  tabIndex={0}
                  role="button"
                  aria-label={node.url}
                  onClick={() => onSelect(node.url)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(node.url);
                    }
                  }}
                  onMouseEnter={() => setHoverUrl(node.url)}
                  onMouseLeave={() => setHoverUrl((u) => (u === node.url ? null : u))}
                  onFocus={() => setHoverUrl(node.url)}
                  onBlur={() => setHoverUrl((u) => (u === node.url ? null : u))}
                >
                  <g className="sc-node-body">
                    <circle className="sc-glow" cx={node.x} cy={node.y} r={(node.r * 2.1).toFixed(1)} />
                    <circle className="sc-disc" cx={node.x} cy={node.y} r={node.r} />
                    <circle className="sc-ring" cx={node.x} cy={node.y} r={(node.r * 0.72).toFixed(1)} />
                    <circle className="sc-core" cx={node.x} cy={node.y} r={(node.r * 0.4).toFixed(1)} />
                  </g>
                  <title>{node.url}</title>
                </g>
              );
            })}
          </g>
        </svg>

        <div aria-hidden="true" className="pointer-events-none absolute bottom-2.5 left-3 flex gap-3 text-[11px] text-[rgba(232,236,243,0.55)]">
          {LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-[5px]">
              <span className={`h-2 w-2 rounded-full ${l.className}`} />
              {l.label}
            </span>
          ))}
        </div>

        {[...shown.values()].map((node) => {
          const label = truncateLabel(node.path, 20);
          const size = chipSize(label);
          const pos = chipPosition(node, box.width, box.height, size.w, size.h);
          return (
            <div
              key={node.url}
              className="pointer-events-none absolute max-w-[220px] truncate rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(10,15,30,0.82)] px-2 py-0.5 text-[11px] leading-[1.4] text-[#f8fafc] shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
              style={{ left: `${pos.left.toFixed(1)}px`, top: `${pos.top.toFixed(1)}px` }}
            >
              {label}
            </div>
          );
        })}

        {hover && (
          <div
            className="pointer-events-none absolute max-w-[240px] rounded-lg border border-[rgba(255,255,255,0.14)] bg-[rgba(11,16,32,0.92)] px-2 py-1.5 text-xs leading-[1.45] text-[#eef2f8] shadow-[0_4px_14px_rgba(0,0,0,0.45)]"
            style={(() => {
              const meta = tooltipMeta(hover);
              const size = tooltipSize(hover.path, meta);
              const pos = tooltipPosition(hover, box.width, box.height, size.w, size.h);
              return { left: `${pos.left.toFixed(1)}px`, top: `${pos.top.toFixed(1)}px` };
            })()}
          >
            <div className="break-words font-semibold text-[#f8fafc]">{hover.path}</div>
            <div className="mt-0.5 text-[#c7cfdd]">{tooltipMeta(hover)}</div>
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-500">Click a node to see what was checked on that page.</p>
    </div>
  );
}
