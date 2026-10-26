import { describe, expect, it } from "vitest";
import { WEBSITE_DESIGNS, designTheme, type WebsiteDesign } from "./designs";
import { LOOKS, LOOK_IDS } from "@/lib/pwa/look";
import { FONT_PAIRS } from "@/lib/pwa/theme-style";

// ── OKLab colour maths, used to keep every new palette and page tint genuinely its own. ──
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function oklab(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const okDist = (a: string, b: string) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));
const okChroma = (hex: string) => Math.hypot(oklab(hex)[1], oklab(hex)[2]);
const relLum = (hex: string) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const wcag = (a: string, b: string) => {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

describe("website designs", () => {
  it("are one hundred, each with a unique id, and the five pure looks carry the look's id and settings", () => {
    expect(WEBSITE_DESIGNS).toHaveLength(100);
    expect(new Set(WEBSITE_DESIGNS.map((d) => d.id)).size).toBe(100);
    for (const look of LOOK_IDS) {
      const d = WEBSITE_DESIGNS.find((x) => x.id === look);
      expect(d?.look).toBe(look);
      expect(d?.theme).toEqual(LOOKS[look].theme);
      expect(d?.hero).toEqual(LOOKS[look].hero);
      expect(d?.opening).toBe(LOOKS[look].quoteOnHome ? "quote" : look === "split" ? "gallery" : "stats");
    }
    // And every look ends up used twenty times.
    for (const look of LOOK_IDS) expect(WEBSITE_DESIGNS.filter((d) => d.look === look)).toHaveLength(20);
  });

  it("keep the original thirty just as distinct: no shared font within a look, and no shared look with the same banner", () => {
    const first = WEBSITE_DESIGNS.slice(0, 30);
    const seen = (key: (d: WebsiteDesign) => string) => {
      const keys = first.map(key);
      expect(new Set(keys).size, keys.join(" | ")).toBe(keys.length);
    };
    seen((d) => `${d.look}/${d.hero.layout}/${d.hero.background}`);
    seen((d) => `${d.look}/${d.theme.font_pair}`);
  });

  it("spread every new design: any pair with a new design differs in at least three of seven structure fields", () => {
    const fields = (d: WebsiteDesign) => [d.look, d.theme.font_pair, d.theme.heading_size, d.theme.button_shape, d.hero.layout, d.hero.background, d.opening];
    for (let i = 30; i < WEBSITE_DESIGNS.length; i++) {
      const a = fields(WEBSITE_DESIGNS[i]);
      for (let j = 0; j < WEBSITE_DESIGNS.length; j++) {
        if (i === j) continue;
        const b = fields(WEBSITE_DESIGNS[j]);
        const diff = a.filter((v, k) => v !== b[k]).length;
        expect(diff, `design ${i} vs ${j}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keep every new primary colour its own (at least 0.06 apart in OKLab)", () => {
    for (let i = 30; i < WEBSITE_DESIGNS.length; i++) {
      for (let j = 0; j < WEBSITE_DESIGNS.length; j++) {
        if (i === j) continue;
        expect(okDist(WEBSITE_DESIGNS[i].palette.primary, WEBSITE_DESIGNS[j].palette.primary), `${i} vs ${j}`).toBeGreaterThanOrEqual(0.06);
      }
    }
  });

  it("tint every new page away from grey and keep page colours apart", () => {
    for (let i = 30; i < WEBSITE_DESIGNS.length; i++) {
      const bg = WEBSITE_DESIGNS[i].theme.background_color!;
      for (let j = 0; j < WEBSITE_DESIGNS.length; j++) {
        if (i === j) continue;
        expect(okDist(bg, WEBSITE_DESIGNS[j].theme.background_color!), `${i} vs ${j}`).toBeGreaterThanOrEqual(0.02);
      }
      const L = oklab(bg)[0];
      const C = okChroma(bg);
      if (WEBSITE_DESIGNS[i].look === "cinematic") {
        expect(L, `dark page ${i}`).toBeLessThanOrEqual(0.30);
        expect(C, `dark page ${i}`).toBeGreaterThanOrEqual(0.01);
      } else {
        expect(L, `light page ${i}`).toBeGreaterThanOrEqual(0.90);
        expect(L, `light page ${i}`).toBeLessThanOrEqual(0.985);
        expect(C, `light page ${i}`).toBeGreaterThanOrEqual(0.012);
      }
    }
  });

  it("keep the new primary readable on its page (WCAG 3:1)", () => {
    for (let i = 30; i < WEBSITE_DESIGNS.length; i++) {
      const d = WEBSITE_DESIGNS[i];
      expect(wcag(d.palette.primary, d.theme.background_color!), `contrast ${i}`).toBeGreaterThanOrEqual(3.0);
    }
  });

  it("balance the whole shelf: every look, font, size, button, layout, paint and opening stays represented", () => {
    // Every non-system font pair stays a real choice (5–18 uses); the system font stays rare.
    for (const key of Object.keys(FONT_PAIRS)) {
      const n = WEBSITE_DESIGNS.filter((d) => d.theme.font_pair === key).length;
      if (key === "system") expect(n, "system").toBeLessThanOrEqual(4);
      else {
        expect(n, key).toBeGreaterThanOrEqual(5);
        expect(n, key).toBeLessThanOrEqual(18);
      }
    }
    const counts = (get: (d: WebsiteDesign) => string) => {
      const m = new Map<string, number>();
      for (const d of WEBSITE_DESIGNS) m.set(get(d), (m.get(get(d)) ?? 0) + 1);
      return [...m.values()];
    };
    for (const n of counts((d) => d.theme.heading_size!)) expect(n).toBeGreaterThanOrEqual(20);
    for (const n of counts((d) => d.theme.button_shape!)) expect(n).toBeGreaterThanOrEqual(20);
    for (const n of counts((d) => d.hero.layout)) expect(n).toBeGreaterThanOrEqual(15);
    for (const n of counts((d) => d.hero.background)) expect(n).toBeGreaterThanOrEqual(15);
    for (const n of counts((d) => d.opening)) expect(n).toBeGreaterThanOrEqual(15);
  });

  it("never show two neighbouring new designs of the same look", () => {
    for (let i = 30; i < WEBSITE_DESIGNS.length - 1; i++) {
      expect(WEBSITE_DESIGNS[i + 1].look, `neighbours ${i} and ${i + 1}`).not.toBe(WEBSITE_DESIGNS[i].look);
    }
  });

  it("give every design a clean, unique id, name and one-line feel", () => {
    const starterIds = new Set<string>([
      "entertainment", "comedians", "photography", "design", "education", "consulting", "art", "health", "marketing",
      "technology", "construction", "apparel", "music", "realestate", "beauty", "travel", "weddings", "website", "food",
      "fitness", "shops", "venues", "local", "scratch", "ai", "portfolio", "business", "store", "events", "gas", "openmic",
      "restaurant", "salon", "community", "blank", "byob",
    ]);
    const names = new Set<string>();
    const feelStarts = new Set<string>();
    for (let i = 0; i < WEBSITE_DESIGNS.length; i++) {
      const d = WEBSITE_DESIGNS[i];
      expect(d.id, d.id).toMatch(/^[a-z]{3,10}$/);
      expect(d.id.includes("--"), d.id).toBe(false);
      if (i >= 30) {
        expect((LOOK_IDS as readonly string[]).includes(d.id), d.id).toBe(false);
        expect(starterIds.has(d.id), d.id).toBe(false);
      }
      const lc = d.name.toLowerCase();
      expect(names.has(lc), d.name).toBe(false);
      names.add(lc);
      expect(d.feel.length, d.id).toBeGreaterThan(20);
      const first4 = d.feel.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
      expect(feelStarts.has(first4), `${d.id} feel starts "${first4}…"`).toBe(false);
      feelStarts.add(first4);
    }
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
