"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, X } from "lucide-react";
import { isMapsBlock } from "@/lib/platform/maps-shared";
import { BLOCK_TYPE_LABELS } from "@/lib/builder/block-defaults";
import { BLOCK_ACCENTS, BLOCK_DESCRIPTIONS, BLOCK_GROUPS, BLOCK_ICONS } from "@/components/builder/blockMeta";
import type { BlockType } from "@/types/database";

/**
 * The "+ Add section" line between two sections of the page, Squarespace-style: it shows when the pointer is near,
 * and opens a visual menu of sections right there, so a new section lands where it was asked for rather than at
 * the bottom. `always` keeps it visible (the empty page, and the end of the page).
 */
export function AddSectionBar({
  onAdd,
  mapsEnabled = true,
  always = false,
  label = "Add section",
}: {
  onAdd: (type: BlockType) => void;
  mapsEnabled?: boolean;
  always?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const pill = (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-lg shadow-indigo-900/40 transition group-hover/add:bg-indigo-500">
      <Plus className="h-3.5 w-3.5" /> {label}
    </span>
  );
  return (
    <div className={`group/add relative z-10 ${always ? "flex h-14 items-center justify-center" : "h-0"}`} onMouseDown={(e) => e.stopPropagation()}>
      {always ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={label} className="focus-visible:outline-none">
          {pill}
        </button>
      ) : (
        // A band across the gap between two sections: hovering it shows the line and the pill, clicking anywhere on it opens the menu.
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className={`absolute inset-x-0 -top-4 flex h-8 items-center justify-center focus-visible:outline-none ${open ? "opacity-100" : "opacity-0 hover:opacity-100 focus-visible:opacity-100"}`}
        >
          <span aria-hidden className="absolute inset-x-6 top-1/2 h-px bg-indigo-500" />
          <span className="relative">{pill}</span>
        </button>
      )}
      {open && <SectionMenu mapsEnabled={mapsEnabled} onClose={() => setOpen(false)} onPick={(type) => { setOpen(false); onAdd(type); }} />}
    </div>
  );
}

function SectionMenu({ mapsEnabled, onClose, onPick }: { mapsEnabled: boolean; onClose: () => void; onPick: (type: BlockType) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const available = (type: BlockType) => mapsEnabled || !isMapsBlock(type);
  const matches = (type: BlockType) =>
    available(type) && (!q || BLOCK_TYPE_LABELS[type].toLowerCase().includes(q) || BLOCK_DESCRIPTIONS[type].toLowerCase().includes(q));
  const groups = BLOCK_GROUPS.map((g) => ({ ...g, types: g.types.filter(matches) })).filter((g) => g.types.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Drawn over the whole builder (a portal), not inside the preview: the phone and laptop frames clip whatever
  // overflows them, and the laptop one is scaled.
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-label="Add a section"
        className="dark w-[34rem] max-w-full rounded-3xl border border-white/10 bg-neutral-950 p-4 text-neutral-100 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <label className="relative block flex-1">
            <span className="sr-only">Search sections</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to add?"
              className="h-10 w-full rounded-full border border-white/10 bg-white/[0.05] pl-9 pr-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/25"
            />
          </label>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {groups.map((group) => (
            <section key={group.label}>
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{group.label}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {group.types.map((type) => {
                  const Icon = BLOCK_ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onPick(type)}
                      className="flex items-center gap-3 rounded-2xl border border-transparent p-2 text-left transition hover:border-white/10 hover:bg-white/[0.06] focus-visible:border-white/25 focus-visible:outline-none"
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br shadow-md ${BLOCK_ACCENTS[type]}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{BLOCK_TYPE_LABELS[type]}</span>
                        <span className="block truncate text-[11px] text-neutral-500">{BLOCK_DESCRIPTIONS[type]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {!groups.length && <p className="px-1 text-xs text-neutral-500">No section matches &ldquo;{query}&rdquo;.</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}
