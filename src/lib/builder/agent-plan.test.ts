import { describe, expect, it } from "vitest";
import { planCurrentPage, planSite } from "./agent-plan";
import type { Draft } from "@/lib/ai/builder-ops";
import type { BlockConfig } from "@/types/database";

const label = (t: string) => t;
let n = 0;
const newId = () => `new-${++n}`;
const block = (id: string, type: string, config: Record<string, unknown>) => ({ id, type, config: config as BlockConfig, minTier: null });
const draftBlock = (type: string, config: Record<string, unknown>) => ({ type: type as "text", config: config as BlockConfig, min_tier: null });

describe("planCurrentPage", () => {
  it("keeps the ids of unchanged sections and marks a changed one with its old words", () => {
    const current = [block("a", "hero", { headline: "Hi" }), block("b", "text", { body: "About" })];
    const plan = planCurrentPage(current, [draftBlock("hero", { headline: "Hello there" }), draftBlock("text", { body: "About" })], label, newId);
    expect(plan.blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(plan.blocks[0].config).toEqual({ headline: "Hello there" });
    expect(plan.pending).toEqual([{ id: "changed:a", kind: "changed", blockId: "a", before: current[0], label: "hero changed" }]);
  });

  it("recognises a moved section as unchanged", () => {
    const current = [block("a", "hero", { headline: "Hi" }), block("b", "text", { body: "About" })];
    const plan = planCurrentPage(current, [draftBlock("text", { body: "About" }), draftBlock("hero", { headline: "Hi" })], label, newId);
    expect(plan.blocks.map((b) => b.id)).toEqual(["b", "a"]);
    expect(plan.pending).toEqual([]);
  });

  it("adds and removes", () => {
    const current = [block("a", "hero", { headline: "Hi" }), block("b", "text", { body: "About" })];
    const plan = planCurrentPage(current, [draftBlock("hero", { headline: "Hi" }), draftBlock("reviews", { title: "Kind words" })], label, newId);
    expect(plan.blocks.map((b) => b.type)).toEqual(["hero", "reviews"]);
    expect(plan.pending.map((p) => p.kind)).toEqual(["added", "removed"]);
    const removed = plan.pending.find((p) => p.kind === "removed");
    expect(removed && removed.kind === "removed" ? removed.index : -1).toBe(1);
  });

  it("an inserted section before a changed one is still an add plus a change, not two adds", () => {
    const current = [block("a", "text", { body: "One" })];
    const plan = planCurrentPage(current, [draftBlock("stats", { items: [] }), draftBlock("text", { body: "One, revised" })], label, newId);
    // Position 1 is a text as before at position 1? No: before had one block at 0, so position 1 is new and 0 is a new stats.
    expect(plan.pending.map((p) => p.kind).sort()).toEqual(["added", "added", "removed"]);
  });
});

describe("planSite", () => {
  const before: Draft = {
    theme: { primary_color: "#000000" },
    pages: [
      { id: "home", name: "Home", path: "home", isHome: true, blocks: [draftBlock("text", { body: "x" })] },
      { id: "about", name: "About", path: "about", isHome: false, blocks: [draftBlock("text", { body: "y" })] },
    ],
  };
  it("reports other pages' changes, new pages, removed pages and the theme", () => {
    const after: Draft = {
      theme: { primary_color: "#000000", bottom_nav: [{ label: "Home", icon: "home", page_path: "home" }] },
      pages: [
        { id: "home", name: "Home", path: "home", isHome: true, blocks: [draftBlock("text", { body: "changed but it is the open page" })] },
        { name: "Private events", path: "private-events", isHome: false, blocks: [draftBlock("text", { body: "new" })] },
      ],
    };
    const plan = planSite(before, after, "home");
    expect(plan.changedPages).toEqual([]);
    expect(plan.newPages.map((p) => p.path)).toEqual(["private-events"]);
    expect(plan.removedPages.map((p) => p.id)).toEqual(["about"]);
    expect(plan.theme?.after.bottom_nav?.length).toBe(1);
  });
});
