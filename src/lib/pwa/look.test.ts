import { describe, expect, it } from "vitest";
import { FONT_PAIRS, themeAttributes, themeStyle } from "./theme-style";
import { HERO_BACKGROUNDS, HERO_LAYOUTS, LOOKS, LOOK_IDS, heroBackground, heroLayout, lookOf, lookTheme } from "./look";

describe("looks", () => {
  it("has five looks, each in a font pair that exists and different from the others", () => {
    expect(LOOK_IDS).toEqual(["classic", "editorial", "cinematic", "bold", "split"]);
    for (const id of LOOK_IDS) expect(FONT_PAIRS[LOOKS[id].theme.font_pair ?? ""], id).toBeDefined();
    expect(new Set(LOOK_IDS.map((id) => LOOKS[id].theme.font_pair)).size).toBe(5);
  });

  it("reads the look from the theme only, never from the fonts, and defaults to classic", () => {
    expect(lookOf(undefined)).toBe("classic");
    expect(lookOf({})).toBe("classic");
    expect(lookOf({ font_pair: "playfair", color_scheme: "dark" })).toBe("classic");
    expect(lookOf({ look: "editorial" })).toBe("editorial");
    expect(lookOf({ look: "nope" as never })).toBe("classic");
  });

  it("choosing a look sets the look and its presets, and switches the dark page off unless the look is dark", () => {
    const editorial = lookTheme("editorial");
    expect(editorial).toMatchObject({ look: "editorial", font_pair: "playfair", color_scheme: "light", background_color: "#faf6ef" });
    expect(lookTheme("cinematic").color_scheme).toBe("dark");
    expect(lookOf(lookTheme("bold"))).toBe("bold");
  });

  it("gives the banner the look's layout and paint unless the banner chose its own", () => {
    expect(heroLayout({}, "editorial")).toBe("centered");
    expect(heroLayout({ layout: "minimal" }, "editorial")).toBe("minimal");
    expect(heroBackground({}, "cinematic")).toBe("mesh");
    expect(heroBackground({ background: "solid" }, "cinematic")).toBe("solid");
    for (const id of LOOK_IDS) {
      expect(HERO_LAYOUTS[LOOKS[id].hero.layout], id).toBeTruthy();
      expect(HERO_BACKGROUNDS[LOOKS[id].hero.background], id).toBeTruthy();
    }
  });

  it("puts the look on the root as a data attribute (not for classic) and an accent colour inline", () => {
    expect(themeAttributes({ look: "bold" })["data-look"]).toBe("bold");
    expect(themeAttributes({ look: "classic" })["data-look"]).toBeUndefined();
    expect(themeAttributes({})["data-look"]).toBeUndefined();
    expect(themeStyle({ accent_color: " #ff0066 " })["--accent"]).toBe("#ff0066");
    expect(themeStyle({})["--accent"]).toBeUndefined();
  });
});
