import { describe, expect, it } from "vitest";
import { WEBSITE_DESIGNS, designTheme } from "./designs";
import { LOOKS, LOOK_IDS } from "@/lib/pwa/look";
import { FONT_PAIRS } from "@/lib/pwa/theme-style";

describe("website designs", () => {
  it("are thirty, each with a unique id, and the five pure looks carry the look's id and settings", () => {
    expect(WEBSITE_DESIGNS).toHaveLength(30);
    expect(new Set(WEBSITE_DESIGNS.map((d) => d.id)).size).toBe(30);
    for (const look of LOOK_IDS) {
      const d = WEBSITE_DESIGNS.find((x) => x.id === look);
      expect(d?.look).toBe(look);
      expect(d?.theme).toEqual(LOOKS[look].theme);
      expect(d?.hero).toEqual(LOOKS[look].hero);
      expect(d?.opening).toBe(LOOKS[look].quoteOnHome ? "quote" : look === "split" ? "gallery" : "stats");
    }
  });

  it("are all different: no two share a look with the same banner layout and paint, a palette, or a font within a look", () => {
    const seen = (key: (d: (typeof WEBSITE_DESIGNS)[number]) => string) => {
      const keys = WEBSITE_DESIGNS.map(key);
      expect(new Set(keys).size, keys.join(" | ")).toBe(keys.length);
    };
    seen((d) => `${d.look}/${d.hero.layout}/${d.hero.background}`);
    seen((d) => d.palette.primary.toLowerCase());
    seen((d) => `${d.look}/${d.theme.font_pair}`);
    // No two designs read the same at a glance either: the type (font, size, buttons) and the page colour together.
    seen((d) => `${d.theme.font_pair}/${d.theme.heading_size}/${d.theme.button_shape}/${(d.theme.background_color ?? "").toLowerCase()}`);
    // And every look is used six times, so a topic's grid is not six of one thing and twenty-four of another.
    for (const look of LOOK_IDS) expect(WEBSITE_DESIGNS.filter((d) => d.look === look)).toHaveLength(6);
    // Every banner layout and every paint appear across the set, and all four openings.
    expect(new Set(WEBSITE_DESIGNS.map((d) => d.hero.layout)).size).toBe(4);
    expect(new Set(WEBSITE_DESIGNS.map((d) => d.hero.background)).size).toBe(4);
    expect(new Set(WEBSITE_DESIGNS.map((d) => d.opening)).size).toBe(4);
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
      if (d.palette.accent) expect(d.palette.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(d.feel.length, d.id).toBeGreaterThan(20);
      // A dark design says so, and a light one on the dark look does not inherit darkness.
      if (d.look === "cinematic") expect(d.theme.color_scheme).toBe("dark");
      else expect(d.theme.color_scheme ?? "light").toBe("light");
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
