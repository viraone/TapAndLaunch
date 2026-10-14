import type { Draft, DraftBlock, DraftPage } from "@/lib/ai/builder-ops";
import type { BlockConfig, ThemeConfig } from "@/types/database";

/**
 * The agent answers with the site before and after. This works out, for the page open in the builder, which sections
 * are unchanged (keep their ids), changed (same place, new words: a Keep / Undo pair on the section), added or
 * removed; and for the rest of the site, which pages changed, were added or removed, and whether the theme changed.
 * Pure, so it is tested without a browser.
 */
export interface PlanBlock {
  id: string;
  type: string;
  config: BlockConfig;
  minTier: string | null;
}

export type PendingChange =
  | { id: string; kind: "changed"; blockId: string; before: PlanBlock; label: string }
  | { id: string; kind: "added"; blockId: string; label: string }
  | { id: string; kind: "removed"; index: number; before: PlanBlock; label: string }
  | { id: string; kind: "page"; pageId: string; name: string; beforeBlocks: DraftBlock[]; label: string }
  | { id: string; kind: "new-page"; pageId: string; name: string; label: string }
  | { id: string; kind: "removed-page"; page: DraftPage; label: string }
  | { id: string; kind: "theme"; before: ThemeConfig; label: string };

export interface CurrentPagePlan {
  blocks: PlanBlock[];
  pending: PendingChange[];
}

const same = (a: { type: string; config: unknown }, b: { type: string; config: unknown }) => a.type === b.type && JSON.stringify(a.config) === JSON.stringify(b.config);

/**
 * The open page's new list of sections, keeping the ids of sections that did not change (so nothing on screen
 * re-mounts), and a pending change for every section that did.
 */
export function planCurrentPage(current: PlanBlock[], after: DraftBlock[], labelFor: (type: string) => string, newId: () => string): CurrentPagePlan {
  const used = new Set<number>();
  const pending: PendingChange[] = [];
  const blocks: PlanBlock[] = [];
  // Pass 1: sections that are exactly as before keep their id, wherever they ended up.
  const match = after.map((b) => {
    const i = current.findIndex((c, idx) => !used.has(idx) && same(c, b));
    if (i !== -1) used.add(i);
    return i;
  });
  // Pass 2: a changed section is one at the same place with the same type that was not matched elsewhere.
  after.forEach((b, position) => {
    if (match[position] !== -1) {
      blocks.push(current[match[position]]);
      return;
    }
    const c = current[position];
    if (c && !used.has(position) && c.type === b.type) {
      used.add(position);
      blocks.push({ id: c.id, type: b.type, config: b.config, minTier: b.min_tier });
      pending.push({ id: `changed:${c.id}`, kind: "changed", blockId: c.id, before: c, label: `${labelFor(b.type)} changed` });
      return;
    }
    const id = newId();
    blocks.push({ id, type: b.type, config: b.config, minTier: b.min_tier });
    pending.push({ id: `added:${id}`, kind: "added", blockId: id, label: `${labelFor(b.type)} added` });
  });
  current.forEach((c, index) => {
    if (!used.has(index)) pending.push({ id: `removed:${c.id}`, kind: "removed", index, before: c, label: `${labelFor(c.type)} removed` });
  });
  return { blocks, pending };
}

export interface SitePlan {
  changedPages: Array<{ page: DraftPage; before: DraftBlock[] }>;
  newPages: DraftPage[];
  removedPages: DraftPage[];
  theme: { before: ThemeConfig; after: ThemeConfig } | null;
}

/** Everything that changed outside the open page. */
export function planSite(before: Draft, after: Draft, currentPageId: string): SitePlan {
  const changedPages: SitePlan["changedPages"] = [];
  const newPages: DraftPage[] = [];
  for (const page of after.pages) {
    if (!page.id) {
      newPages.push(page);
      continue;
    }
    if (page.id === currentPageId) continue;
    const old = before.pages.find((p) => p.id === page.id);
    if (!old) continue;
    if (JSON.stringify(old.blocks) !== JSON.stringify(page.blocks)) changedPages.push({ page, before: old.blocks });
  }
  const removedPages = before.pages.filter((p) => p.id && !after.pages.some((q) => q.id === p.id));
  const theme = JSON.stringify(before.theme) !== JSON.stringify(after.theme) ? { before: before.theme, after: after.theme } : null;
  return { changedPages, newPages, removedPages, theme };
}
