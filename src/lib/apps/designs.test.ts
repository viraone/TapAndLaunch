import { describe, expect, it } from "vitest";
import { WEBSITE_DESIGNS, designTheme } from "./designs";
import { LOOKS, LOOK_IDS } from "@/lib/pwa/look";
import { FONT_PAIRS } from "@/lib/pwa/theme-style";

describe("website designs", () => {
  it("are fifteen, each with a unique id, and the five pure looks carry the look's id and settings", () => {
    expect(WEBSITE_DESIGNS).toHaveLength(15);
    expect(new Set(WEBSITE_DESIGNS.map((d) => d.id)).size).toBe(15);
    for (const look of LOOK_IDS) {
      const d = WEBSITE_DESIGNS.find((x) => x.id === look);
      expect(d?.look).toBe(look);
      expect(d?.theme).toEqual(LOOKS[look].theme);
      expect(d?.hero).toEqual(LOOKS[look].hero);
      expect(d?.opening).toBe(LOOKS[look].quoteOnHome ? "quote" : look === "split" ? "gallery" : "stats");
    }
  });

  it("are all different: no two share a look and banner layout, a palette, or a font within a look", () => {
    const seen = (key: (d: (typeof WEBSITE_DESIGNS)[number]) => string) => {
      const keys = WEBSITE_DESIGNS.map(key);
      expect(new Set(keys).size, keys.join(" | ")).toBe(keys.length);
    };
    seen((d) => `${d.look}/${d.hero.layout}`);
    seen((d) => d.palette.primary.toLowerCase());
    seen((d) => `${d.look}/${d.theme.font_pair}`);
    // And every look is used three times, so a topic's grid is not three of one thing and twelve of another.
    for (const look of LOOK_IDS) expect(WEBSITE_DESIGNS.filter((d) => d.look === look)).toHaveLength(3);
  });

  it("only use settings the site really has", () => {
    for (const d of WEBSITE_DESIGNS) {
      expect(LOOK_IDS, d.id).toContain(d.look);
      expect(Object.keys(FONT_PAIRS), d.id).toContain(d.theme.font_pair);
      expect(["normal", "large", "compact"]).toContain(d.theme.heading_size);
      expect(["round", "rounded", "square"]).toContain(d.theme.button_shape);
      expect(["full", "centered", "split", "minimal"]).toContain(d.hero.layout);
      expect(["solid", "gradient", "mesh", "grain"]).toContain(d.hero.background);
      expect(d.theme.background_color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(d.palette.primary).toMatch(/^#[0-9a-f]{6}$/i);
      // A dark design says so, and a light one on the dark look does not inherit darkness.
      if (d.look === "cinematic") expect(d.theme.color_scheme).toBe("dark");
    }
  });

  it("keep a starter's own colour on its own design and use the design's palette otherwise", () => {
    const noir = WEBSITE_DESIGNS.find((d) => d.id === "noir")!;
    expect(designTheme(noir, "#334155", false)).toMatchObject({ primary_color: "#d4a373", accent_color: "#e9d8b4", look: "cinematic", color_scheme: "dark" });
    const cinematic = WEBSITE_DESIGNS.find((d) => d.id === "cinematic")!;
    expect(designTheme(cinematic, "#334155", true)).toMatchObject({ primary_color: "#334155", color_scheme: "dark" });
    expect(designTheme(cinematic, "#334155", true)).not.toHaveProperty("accent_color");
    const paper = WEBSITE_DESIGNS.find((d) => d.id === "paper")!;
    expect(designTheme(paper, "#334155", false).color_scheme).toBe("light");
  });
});
