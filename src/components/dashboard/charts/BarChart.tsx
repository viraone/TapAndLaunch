"use client";

import { useState } from "react";
import type { PageCount } from "@/lib/analytics/aggregate";

const ROW_HEIGHT = 28;
const BAR_HEIGHT = 18; // under the 24px cap
const LABEL_WIDTH = 140;
const CHART_WIDTH = 640;

/**
 * Horizontal single-series bar chart ("views by page"). Value labels are
 * placed unconditionally just outside the bar's end rather than measured
 * against available inside-bar space — a deliberate simplification (see the
 * dataviz skill's label-fit rule) that sidesteps text-measurement code while
 * still never clipping a label, since "outside" always has room.
 */
export function BarChart({ data, color = "var(--chart-1)" }: { data: PageCount[]; color?: string }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No page views yet.</p>;
  }

  const maxValue = Math.max(...data.map((d) => d.count), 1);
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - 48;
  const height = data.length * ROW_HEIGHT;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${height}`} className="w-full" role="img" aria-label="Views by page">
        {data.map((d, i) => {
          const y = i * ROW_HEIGHT;
          const barWidth = (d.count / maxValue) * plotWidth;
          const isHovered = hoveredId === d.pageId;
          return (
            <g key={d.pageId}>
              <text
                x={LABEL_WIDTH - 8}
                y={y + ROW_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-foreground text-[11px]"
              >
                {d.pageName}
              </text>
              <rect
                x={LABEL_WIDTH}
                y={y + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                width={Math.max(barWidth, 2)}
                height={BAR_HEIGHT}
                rx={4}
                fill={color}
                opacity={isHovered ? 0.85 : 1}
                onPointerEnter={() => setHoveredId(d.pageId)}
                onPointerLeave={() => setHoveredId(null)}
              />
              <text
                x={LABEL_WIDTH + barWidth + 6}
                y={y + ROW_HEIGHT / 2}
                dominantBaseline="middle"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {d.count.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
