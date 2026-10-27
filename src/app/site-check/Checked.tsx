"use client";

import { useState } from "react";
import type { PageEvent } from "seositetuneup";
import { POINTS, scoreRows, severityDot } from "./lib/stages";

/** A fact with a bar showing where the value sits against the min–max limits. */
function LengthBar({ label, value, limits }: { label: string; value: number | null; limits: { min: number; max: number } }) {
  const scaleMax = value !== null ? Math.max(limits.max * 1.5, value) : limits.max * 1.5;
  const zoneLeft = (limits.min / scaleMax) * 100;
  const zoneWidth = ((limits.max - limits.min) / scaleMax) * 100;
  return (
    <>
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="m-0 min-w-0">
        <span className="inline-block">{value === null ? "missing" : `${value} chars`}</span>
        {value !== null && (
          <span className="relative mt-1 block h-2.5 rounded-[5px] bg-neutral-200">
            <span
              className="absolute bottom-0 top-0 rounded-[5px] bg-green-600/25"
              style={{ left: `${zoneLeft.toFixed(1)}%`, width: `${zoneWidth.toFixed(1)}%` }}
            />
            <span
              className="absolute -top-[3px] h-4 w-1 rounded-[2px] bg-blue-600"
              style={{ left: `${((value / scaleMax) * 100).toFixed(1)}%` }}
            />
          </span>
        )}
      </dd>
    </>
  );
}

/** The page score as a small table; clicking a problem row reveals its full message. */
function ScoreTable({ page }: { page: PageEvent }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const rows = scoreRows(page.score);

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <table className="my-3 w-full table-fixed border-collapse text-sm">
      <tbody>
        {rows.map((row, i) => {
          if (row.kind === "start") {
            return (
              <tr key={i} className="text-neutral-500">
                <td className="border-b border-neutral-200 px-1 py-1.5 align-top break-words">{row.label}</td>
                <td className="w-[3.2em] border-b border-neutral-200 px-1 py-1.5 text-right font-bold tabular-nums">{row.points}</td>
              </tr>
            );
          }
          if (row.kind === "total") {
            return (
              <tr key={i}>
                <th className="border-t-2 border-neutral-200 px-1 py-1.5 text-left font-bold break-words">{row.label}</th>
                <td className="w-[3.2em] border-t-2 border-neutral-200 px-1 py-1.5 text-right font-bold tabular-nums">{row.points}</td>
              </tr>
            );
          }
          const expanded = open.has(i);
          return (
            <tr
              key={i}
              tabIndex={0}
              role="button"
              aria-expanded={expanded}
              onClick={() => toggle(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(i);
                }
              }}
              className="cursor-pointer hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
            >
              <td className="border-b border-neutral-200 px-1 py-1.5 align-top">
                <span className="flex items-center gap-1.5">
                  <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${severityDot(row.severity ?? "info")}`} />
                  <span className="font-semibold">{row.label}</span>
                </span>
                {expanded && <span className="mt-[3px] block text-xs text-neutral-500">{row.message}</span>}
              </td>
              <td className="w-[3.2em] border-b border-neutral-200 px-1 py-1.5 text-right font-bold tabular-nums">{row.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** "What it checked": the selected page's facts, score table, then each finding with its fix. */
export function Checked({
  page,
  titleLimits,
  descriptionLimits,
}: {
  page: PageEvent | null;
  titleLimits: { min: number; max: number };
  descriptionLimits: { min: number; max: number };
}) {
  if (!page) return <p className="text-neutral-500">Run a check to see the checks on the latest page.</p>;

  const f = page.facts;
  const byId = new Map(page.score.deductions.map((d) => [d.id, d.points]));

  return (
    <div>
      <h3 className="text-[1.05rem] break-words">{f.title || page.finalUrl || page.url}</h3>
      <p className="text-neutral-500">
        {page.status} · {page.bytes} bytes · {page.ms} ms
      </p>
      {page.finalUrl && page.finalUrl !== page.url && <p className="break-all text-neutral-500">Final address: {page.finalUrl}</p>}

      <dl className="my-2.5 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
        <LengthBar label="Title" value={f.title === null ? null : f.title.length} limits={titleLimits} />
        <LengthBar label="Description" value={f.description === null ? null : f.description.length} limits={descriptionLimits} />
        <dt className="text-sm text-neutral-500">H1 headings</dt>
        <dd className="m-0 min-w-0">{f.h1.length}</dd>
        <dt className="text-sm text-neutral-500">Canonical</dt>
        <dd className="m-0 min-w-0">{f.canonical ? "set" : "missing"}</dd>
        <dt className="text-sm text-neutral-500">Words</dt>
        <dd className="m-0 min-w-0">{f.wordCount}</dd>
        <dt className="text-sm text-neutral-500">Images</dt>
        <dd className="m-0 min-w-0">{f.imageCount}</dd>
        <dt className="text-sm text-neutral-500">Internal links</dt>
        <dd className="m-0 min-w-0">{f.internalLinks.length}</dd>
        <dt className="text-sm text-neutral-500">Outside links</dt>
        <dd className="m-0 min-w-0">{f.externalLinkCount}</dd>
        <dt className="text-sm text-neutral-500">Builder</dt>
        <dd className="m-0 min-w-0">{f.builder?.name || "unknown"}</dd>
      </dl>

      <ScoreTable page={page} />

      <div className="flex flex-col gap-2">
        {page.findings.map((finding, i) => {
          const cost = byId.get(finding.id) ?? POINTS[finding.severity] ?? 0;
          return (
            <div key={i} className="rounded-lg border border-neutral-200 p-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="rounded-[10px] bg-neutral-100 px-1.5 py-0.5 text-[0.72rem] font-bold uppercase text-neutral-500">{finding.severity}</span>
                <span className="font-bold text-neutral-500">−{cost}</span>
              </span>
              <div className="mt-1 font-semibold break-words">{finding.message}</div>
              <div className="mt-0.5 break-words text-neutral-500">{finding.fix}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
