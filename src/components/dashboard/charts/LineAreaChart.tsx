"use client";

import { useState } from "react";
import { niceMax } from "@/lib/analytics/nice-scale";
import type { DailyCount } from "@/lib/analytics/aggregate";

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 12, bottom: 24, left: 36 };

/**
 * A single-series line + area chart with a crosshair tooltip — per the
 * dataviz skill: single series needs no legend (the title already names
 * it), the endpoint gets a direct label, gridlines are hairline and
 * recessive, and the area fill is a ~10% wash of the line's own color.
 */
export function LineAreaChart({ data, color = "var(--chart-1)" }: { data: DailyCount[]; color?: string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = niceMax(Math.max(...data.map((d) => d.count), 1));

  const xFor = (index: number) =>
    PADDING.left + (data.length <= 1 ? 0 : (index / (data.length - 1)) * plotWidth);
  const yFor = (value: number) => PADDING.top + plotHeight - (value / maxValue) * plotHeight;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.count)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(data.length - 1)} ${PADDING.top + plotHeight} L ${xFor(0)} ${
    PADDING.top + plotHeight
  } Z`;

  const gridlineValues = [0, maxValue / 2, maxValue];
  const last = data[data.length - 1];

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const fraction = data.length <= 1 ? 0 : (relativeX - PADDING.left) / plotWidth;
    const index = Math.round(fraction * (data.length - 1));
    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Views over time">
        {gridlineValues.map((value) => (
          <line
            key={value}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={yFor(value)}
            y2={yFor(value)}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {gridlineValues.map((value) => (
          <text
            key={value}
            x={PADDING.left - 8}
            y={yFor(value)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {Math.round(value).toLocaleString()}
          </text>
        ))}

        <path d={areaPath} fill={color} opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {last && (
          <>
            <circle cx={xFor(data.length - 1)} cy={yFor(last.count)} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
            <text
              x={xFor(data.length - 1)}
              y={yFor(last.count) - 10}
              textAnchor="end"
              className="fill-foreground text-[10px] font-medium"
            >
              {last.count.toLocaleString()}
            </text>
          </>
        )}

        {hovered && hoverIndex !== null && (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={PADDING.top}
            y2={PADDING.top + plotHeight}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
          />
        )}

        {/* Transparent hit layer spanning the whole plot — the crosshair
            tracks the pointer and snaps to the nearest day, so the reader
            aims at a date, not a 2px line. */}
        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>

      {hovered && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"
          style={{
            left: `${(xFor(hoverIndex) / WIDTH) * 100}%`,
            transform: hoverIndex > data.length / 2 ? "translateX(-100%)" : undefined,
          }}
        >
          <div className="text-muted-foreground">{hovered.date}</div>
          <div className="font-semibold">{hovered.count.toLocaleString()} views</div>
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">View as table</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="font-medium">Date</th>
              <th className="font-medium">Views</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t">
                <td className="py-1">{d.date}</td>
                <td className="py-1 tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
