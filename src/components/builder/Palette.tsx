"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { BLOCK_TYPE_LABELS } from "@/lib/builder/block-defaults";
import { BLOCK_ACCENTS, BLOCK_DESCRIPTIONS, BLOCK_GROUPS, BLOCK_ICONS } from "@/components/builder/blockMeta";
import type { BlockType } from "@/types/database";

/**
 * Adds blocks by click rather than drag-from-palette. Reordering already-
 * placed blocks is the drag interaction (`SortableBlockItem`); a second,
 * cross-container drag source here would roughly double the dnd-kit wiring
 * for a rarer action (you add a block once, then reorder it many times).
 */
export function Palette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (type: BlockType) =>
    !q || BLOCK_TYPE_LABELS[type].toLowerCase().includes(q) || BLOCK_DESCRIPTIONS[type].toLowerCase().includes(q);
  const groups = BLOCK_GROUPS.map((g) => ({ ...g, types: g.types.filter(matches) })).filter((g) => g.types.length);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-sm font-semibold text-neutral-100">Add a block</p>
        <p className="mt-0.5 text-xs text-neutral-500">Click to add it to this page.</p>
      </div>
      <label className="relative block">
        <span className="sr-only">Search blocks</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
        <input
          id="block-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search blocks"
          className="h-9 w-full rounded-full border border-white/10 bg-white/[0.04] pl-8 pr-3 text-xs text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/25"
        />
      </label>

      {groups.map((group) => (
        <section key={group.label} className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{group.label}</p>
          {group.types.map((type) => {
            const Icon = BLOCK_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => onAdd(type)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-transparent p-2 text-left transition hover:border-white/10 hover:bg-white/[0.05] focus-visible:border-white/20 focus-visible:outline-none"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br shadow-md ${BLOCK_ACCENTS[type]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-neutral-100">{BLOCK_TYPE_LABELS[type]}</span>
                  <span className="block text-[11px] leading-snug text-neutral-500">{BLOCK_DESCRIPTIONS[type]}</span>
                </span>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-neutral-950 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </section>
      ))}
      {!groups.length && <p className="px-1 text-xs text-neutral-500">No block matches “{query}”.</p>}
    </div>
  );
}
