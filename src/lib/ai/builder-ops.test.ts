import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AiReply, LIBRARY_PHOTOS, applyOperations, buildContext, toStoredBlock, type Draft } from "./builder-ops";

const start = (): Draft => ({
  theme: { primary_color: "#111111" },
  pages: [
    { id: "p1", name: "Home", path: "home", isHome: true, blocks: [{ type: "text", config: { heading: "Hi", body: "" }, min_tier: null }, { type: "class_finder", config: {} as never, min_tier: null }] },
  ],
});

describe("the AI's reply is checked", () => {
  it("accepts a normal reply", () => {
    const ok = AiReply.safeParse({ reply: "Added a menu.", ops: [{ op: "add_page", name: "Menu", path: "menu" }, { op: "add_block", page: "menu", block: { type: "price_list", sections: [{ name: "Mains", items: [{ name: "Tacos", price: "$4" }] }] } }] });
    expect(ok.success).toBe(true);
  });
  it("rejects blocks and values it may not use", () => {
    const bad = [
      { op: "add_block", page: "home", block: { type: "video", url: "https://evil.example" } },
      { op: "add_block", page: "home", block: { type: "gas_directory" } },
      { op: "add_block", page: "home", block: { type: "hero", photo: "https://evil.example/x.jpg" } },
      { op: "add_page", name: "Admin", path: "../admin" },
      { op: "add_page", name: "Sw", path: "sw.js" },
      { op: "add_page", name: "Orders", path: "orders" },
      { op: "set_theme", primary_color: "red" },
      { op: "drop_table" },
    ];
    for (const op of bad) expect(AiReply.safeParse({ reply: "", ops: [op] }).success, JSON.stringify(op)).toBe(false);
  });
});

describe("applyOperations", () => {
  it("adds a page and blocks, and keeps the tab bar in step", () => {
    const { draft, applied, skipped } = applyOperations(start(), [
      { op: "add_page", name: "Menu", path: "menu" },
      { op: "add_block", page: "menu", block: { type: "text", heading: "Menu" } },
      { op: "add_block", page: "home", block: { type: "hero", photo: "restaurant-hero", headline: "Tacos!" }, index: 0 },
    ]);
    expect(applied).toBe(3);
    expect(skipped).toEqual([]);
    expect(draft.pages.map((p) => p.path)).toEqual(["home", "menu"]);
    expect(draft.pages[0]?.blocks[0]?.type).toBe("hero");
    expect((draft.pages[0]?.blocks[0]?.config as { image_url: string }).image_url).toMatch(/\/templates\/restaurant-hero\.jpg$/);
    expect(draft.theme.bottom_nav?.map((n) => n.page_path)).toEqual(["home", "menu"]);
  });

  it("skips steps that don't fit, without breaking the rest", () => {
    const { draft, applied, skipped } = applyOperations(start(), [
      { op: "remove_page", path: "home" },
      { op: "replace_block", page: "home", index: 1, block: { type: "text", heading: "x" } },
      { op: "remove_block", page: "nope", index: 0 },
      { op: "set_theme", primary_color: "#ea580c", dark: true },
    ]);
    expect(applied).toBe(1);
    expect(skipped).toHaveLength(3);
    expect(draft.pages).toHaveLength(1);
    expect(draft.pages[0]?.blocks[1]?.type).toBe("class_finder");
    expect(draft.theme).toMatchObject({ primary_color: "#ea580c", color_scheme: "dark" });
  });

  it("moves, replaces and removes blocks, and never changes the original", () => {
    const original = start();
    const { draft } = applyOperations(original, [
      { op: "add_block", page: "home", block: { type: "stats", items: [{ value: "1", label: "a" }] } },
      { op: "move_block", page: "home", from: 2, to: 0 },
      { op: "replace_block", page: "home", index: 1, block: { type: "text", heading: "New" } },
      { op: "remove_block", page: "home", index: 2 },
    ]);
    expect(draft.pages[0]?.blocks.map((b) => b.type)).toEqual(["stats", "text"]);
    expect((draft.pages[0]?.blocks[1]?.config as { heading: string }).heading).toBe("New");
    expect(original.pages[0]?.blocks).toHaveLength(2);
  });

  it("refuses duplicate pages", () => {
    const { skipped } = applyOperations(start(), [{ op: "add_page", name: "Home again", path: "home" }]);
    expect(skipped[0]).toContain("already exists");
  });
});

describe("context and photos", () => {
  it("shows the model photo names, not addresses, and marks blocks it can't change", () => {
    const d = start();
    d.pages[0]?.blocks.push({ ...toStoredBlock({ type: "hero", photo: "gym-hero", headline: "x" }), min_tier: null });
    const ctx = JSON.parse(buildContext("Gym", d));
    expect(ctx.pages[0].blocks[2]).toMatchObject({ type: "hero", photo: "gym-hero" });
    expect(ctx.pages[0].blocks[1].note).toContain("can't be changed");
  });
  it("only lists photos that really exist", () => {
    for (const name of LIBRARY_PHOTOS) expect(existsSync(join(process.cwd(), "public/templates", `${name}.jpg`)), name).toBe(true);
  });
});
