import type { ThemeConfig } from "@/types/database";

/**
 * Site-wide looks beyond the two colours: a pair of fonts, how big headings run, and the shape of buttons. All of it
 * becomes CSS variables and data attributes on the app's root (the published site and the builder's preview use the
 * same `themeStyle`), so the sections themselves don't change.
 */

export interface FontPair {
  name: string;
  /** One line that says what it is like. */
  feel: string;
  heading: string;
  body: string;
  /** The Google Fonts families to load; empty for the system font. */
  families: string[];
}

export const FONT_PAIRS: Record<string, FontPair> = {
  system: { name: "Standard", feel: "The phone's own font. Fast and familiar.", heading: "", body: "", families: [] },
  inter: { name: "Inter", feel: "Clean and modern, like an app.", heading: "Inter", body: "Inter", families: ["Inter:wght@400;500;600;700;800"] },
  poppins: { name: "Poppins", feel: "Round and friendly.", heading: "Poppins", body: "Poppins", families: ["Poppins:wght@400;500;600;700;800"] },
  playfair: { name: "Playfair & Source Sans", feel: "Elegant headlines, easy reading.", heading: "Playfair Display", body: "Source Sans 3", families: ["Playfair+Display:wght@700;800", "Source+Sans+3:wght@400;600;700"] },
  dm: { name: "DM Serif & DM Sans", feel: "Classy with a modern body.", heading: "DM Serif Display", body: "DM Sans", families: ["DM+Serif+Display", "DM+Sans:wght@400;500;600;700"] },
  lora: { name: "Lora & Lato", feel: "Warm and bookish.", heading: "Lora", body: "Lato", families: ["Lora:wght@600;700", "Lato:wght@400;700"] },
  montserrat: { name: "Montserrat & Open Sans", feel: "Bold and open.", heading: "Montserrat", body: "Open Sans", families: ["Montserrat:wght@600;700;800", "Open+Sans:wght@400;600;700"] },
  space: { name: "Space Grotesk & Inter", feel: "Techy, a little quirky.", heading: "Space Grotesk", body: "Inter", families: ["Space+Grotesk:wght@600;700", "Inter:wght@400;500;600"] },
  bebas: { name: "Bebas Neue & Nunito", feel: "Poster headlines, soft body. Great for shows.", heading: "Bebas Neue", body: "Nunito", families: ["Bebas+Neue", "Nunito:wght@400;600;700;800"] },
};

export const HEADING_SIZES: Record<string, string> = { normal: "Normal", large: "Larger", compact: "Smaller" };
export const BUTTON_SHAPES: Record<string, string> = { round: "Pill (fully round)", rounded: "Rounded corners", square: "Square corners" };

const BUTTON_RADIUS: Record<string, string> = { round: "9999px", rounded: "0.75rem", square: "0.25rem" };

/** The address of the stylesheet that loads the pair's fonts, or null for the system font. */
export function fontsHref(theme: ThemeConfig): string | null {
  const pair = theme.font_pair ? FONT_PAIRS[theme.font_pair] : undefined;
  if (!pair || pair.families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${pair.families.map((f) => `family=${f}`).join("&")}&display=swap`;
}

/** CSS variables for the root of the app. `font_family` (typed by hand) still wins over a pair for the body. */
export function themeStyle(theme: ThemeConfig): Record<string, string> {
  const pair = theme.font_pair ? FONT_PAIRS[theme.font_pair] : undefined;
  const vars: Record<string, string> = {};
  const body = theme.font_family?.trim() || (pair?.body ? `"${pair.body}", system-ui, sans-serif` : "");
  if (body) vars.fontFamily = body;
  if (pair?.heading) vars["--font-heading"] = `"${pair.heading}", ${body || "system-ui, sans-serif"}`;
  if (theme.button_shape && BUTTON_RADIUS[theme.button_shape]) vars["--button-radius"] = BUTTON_RADIUS[theme.button_shape];
  return vars;
}

/** Data attributes for the root of the app (headings scale through Tailwind's size variables; see globals.css). */
export function themeAttributes(theme: ThemeConfig): Record<string, string> {
  const attrs: Record<string, string> = { "data-app-styles": "" };
  if (theme.heading_size && theme.heading_size !== "normal") attrs["data-heading-size"] = theme.heading_size;
  return attrs;
}
