import { describe, expect, it } from "vitest";
import { isReservedPagePath } from "@/lib/pwa/reserved-paths";
import { BLOCK_TYPES } from "@/lib/builder/block-defaults";
import { STARTER_TEMPLATES, TEMPLATE_CATEGORIES, buildStarter, isTemplateId, templateNeedsMaps } from "./templates";

describe("starter templates", () => {
  it("offers a template for everything, ending with a blank one", () => {
    expect(STARTER_TEMPLATES.map((t) => t.id)).toEqual(["business", "store", "events", "food", "gas", "openmic", "restaurant", "fitness", "salon", "community", "blank"]);
    expect(STARTER_TEMPLATES.at(-1)?.id).toBe("blank");
    expect(isTemplateId("store")).toBe(true);
    expect(isTemplateId("nope")).toBe(false);
  });

  it("groups every template under a real category, and every category has a template", () => {
    const ids = TEMPLATE_CATEGORIES.map((c) => c.id);
    for (const t of STARTER_TEMPLATES) expect(ids).toContain(t.category);
    for (const c of TEMPLATE_CATEGORIES) expect(STARTER_TEMPLATES.some((t) => t.category === c.id)).toBe(true);
  });

  for (const template of STARTER_TEMPLATES) {
    it(`${template.id} builds a valid app`, () => {
      const starter = buildStarter(template.id, "Maple Street Bakery");
      const paths = starter.pages.map((p) => p.path);

      expect(starter.pages.filter((p) => p.isHome)).toHaveLength(1);
      expect(new Set(paths).size).toBe(paths.length);
      for (const path of paths) expect(isReservedPagePath(path)).toBe(false);
      for (const page of starter.pages) for (const b of page.blocks) expect(BLOCK_TYPES).toContain(b.type);
      for (const tab of starter.theme.bottom_nav ?? []) expect(paths).toContain(tab.page_path);
      expect(starter.manifest.name).toBe("Maple Street Bakery");
    });
  }

  it("opens every finished template with a photo banner that has a headline", () => {
    for (const t of STARTER_TEMPLATES.filter((x) => !["food", "gas", "blank"].includes(x.id))) {
      const first = buildStarter(t.id, "Maple Street Bakery").pages[0]?.blocks[0];
      expect(first?.type, t.id).toBe("hero");
      expect((first?.config as { image_url?: string; headline?: string }).image_url, t.id).toMatch(/\/templates\/.+\.jpg$/);
      expect((first?.config as { headline?: string }).headline, t.id).toBeTruthy();
    }
  });

  it("gives every hero button a page that exists in the same app", () => {
    for (const t of STARTER_TEMPLATES) {
      const starter = buildStarter(t.id, "x");
      const paths = new Set(starter.pages.map((p) => p.path));
      for (const p of starter.pages)
        for (const b of p.blocks)
          if (b.type === "hero" && (b.config as { button_page?: string }).button_page) expect(paths, `${t.id} hero button`).toContain((b.config as { button_page: string }).button_page);
    }
  });

  it("knows which starters use Google Maps", () => {
    expect(STARTER_TEMPLATES.filter((t) => templateNeedsMaps(t.id)).map((t) => t.id)).toEqual(["food", "gas"]);
  });

  it("puts the app's name in the header bar of every starter", () => {
    for (const t of STARTER_TEMPLATES) expect(buildStarter(t.id, "Maple Street Bakery").theme.header_title).toBe("Maple Street Bakery");
  });

  it("starts the blank template with an empty Home page", () => {
    const starter = buildStarter("blank", "X");
    expect(starter.pages).toEqual([{ name: "Home", path: "home", isHome: true, blocks: [] }]);
  });

  it("treats an unknown template as blank", () => {
    expect(buildStarter("whatever", "X").pages[0].blocks).toEqual([]);
  });
});
