import { LOOKS, type HeroBackground, type HeroLayout, type LookId } from "@/lib/pwa/look";
import type { HeroBlockConfig, ThemeConfig } from "@/types/database";

/**
 * The designs a website starter comes in: thirty complete recipes, the way a Squarespace topic lists a shelf of
 * templates. A design is not a coat of paint on one layout; it sets everything the site-wide controls can set
 * (the look, the fonts, the heading size, the button shape, light or dark, the page colour, its own palette), how
 * the banner is laid out and painted, and what the first screen after the banner is. Every field is something the
 * published site really renders, so the card in the picker is the site and nothing more.
 *
 * Five of them are the pure looks (lib/pwa/look.ts) and carry the look's id, so a starter's bare template id still
 * builds its own look. The other twenty-five each pair a look with a different banner, type and palette, six designs
 * to a look; a test keeps any two designs from sharing a look with the same banner layout and paint, a palette, or a
 * font within a look, because thirty cards that look alike are worse than five.
 */
export interface WebsiteDesign {
  id: string;
  name: string;
  /** One line that says what it is like, under the card. */
  feel: string;
  /** How the highlights, reviews, newsletter and header are put together (lib/pwa/look.ts). */
  look: LookId;
  theme: Pick<ThemeConfig, "font_pair" | "heading_size" | "button_shape" | "color_scheme" | "background_color">;
  /** The design's own colours. A starter's own design (the pure look its bare id builds) keeps the starter's colour
   * instead, so Photography's own design stays Photography-coloured. */
  palette: { primary: string; accent?: string };
  hero: { layout: HeroLayout; background: HeroBackground };
  /** What comes right after the banner on Home: the numbers, the work, the story, or the quote. */
  opening: "stats" | "gallery" | "about" | "quote";
}

const pure = (look: LookId, name: string, feel: string, palette: WebsiteDesign["palette"], opening: WebsiteDesign["opening"]): WebsiteDesign => ({
  id: look,
  name,
  feel,
  look,
  theme: LOOKS[look].theme,
  palette,
  hero: LOOKS[look].hero,
  opening,
});

export const WEBSITE_DESIGNS: WebsiteDesign[] = [
  // ── The five looks as they are.
  pure("classic", "Classic", "Clean and direct: a colour banner, tidy tiles, pill buttons.", { primary: "#1d4ed8" }, "stats"),
  pure("editorial", "Editorial", "Serif headlines on warm paper, a centred banner, a pull quote. Like a magazine.", { primary: "#9f1239" }, "quote"),
  pure("cinematic", "Cinematic", "A dark site with the colour as light: a glowing banner, glass cards.", { primary: "#7c3aed" }, "stats"),
  pure("bold", "Bold", "Poster headlines, square corners, giant numbers on a black band.", { primary: "#ea580c" }, "stats"),
  pure("split", "Split", "The headline beside the work, soft tinted panels.", { primary: "#0f766e" }, "gallery"),

  // ── Ten more, each a different banner, type and palette on one of the looks.
  {
    id: "noir",
    name: "Noir",
    feel: "Black page, a huge serif headline, your work straight under it. For people whose pictures do the talking.",
    look: "cinematic",
    theme: { font_pair: "playfair", heading_size: "large", button_shape: "square", color_scheme: "dark", background_color: "#000000" },
    palette: { primary: "#d4a373", accent: "#e9d8b4" },
    hero: { layout: "minimal", background: "solid" },
    opening: "gallery",
  },
  {
    id: "paper",
    name: "Paper",
    feel: "Warm paper, a bookish serif, a big quiet headline and your story first.",
    look: "editorial",
    theme: { font_pair: "lora", heading_size: "normal", button_shape: "rounded", background_color: "#f5efe6" },
    palette: { primary: "#3f6212" },
    hero: { layout: "minimal", background: "solid" },
    opening: "about",
  },
  {
    id: "poster",
    name: "Poster",
    feel: "Black on white, a headline the size of the page, numbers on a band. Loud on purpose.",
    look: "bold",
    theme: { font_pair: "montserrat", heading_size: "large", button_shape: "square", background_color: "#ffffff" },
    palette: { primary: "#111111", accent: "#dc2626" },
    hero: { layout: "minimal", background: "grain" },
    opening: "stats",
  },
  {
    id: "gallery",
    name: "Gallery",
    feel: "White walls: a centred headline, then the work in a grid. Nothing in the way.",
    look: "split",
    theme: { font_pair: "inter", heading_size: "normal", button_shape: "square", background_color: "#ffffff" },
    palette: { primary: "#171717" },
    hero: { layout: "centered", background: "solid" },
    opening: "gallery",
  },
  {
    id: "sunset",
    name: "Sunset",
    feel: "Round and friendly: a coral panel beside the words, soft cream page, your story up top.",
    look: "classic",
    theme: { font_pair: "poppins", heading_size: "large", button_shape: "round", background_color: "#fff7ed" },
    palette: { primary: "#f43f5e" },
    hero: { layout: "split", background: "gradient" },
    opening: "about",
  },
  {
    id: "studio",
    name: "Studio",
    feel: "A cool tinted page, a techy grotesk, an indigo gradient banner and the numbers. Reads like a product.",
    look: "split",
    theme: { font_pair: "space", heading_size: "normal", button_shape: "rounded", background_color: "#eef2ff" },
    palette: { primary: "#4f46e5" },
    hero: { layout: "full", background: "gradient" },
    opening: "stats",
  },
  {
    id: "velvet",
    name: "Velvet",
    feel: "Deep plum dark, a serif display face, the banner centred over a glow, the quote first.",
    look: "cinematic",
    theme: { font_pair: "dm", heading_size: "large", button_shape: "round", color_scheme: "dark", background_color: "#140d1a" },
    palette: { primary: "#db2777", accent: "#f9a8d4" },
    hero: { layout: "centered", background: "mesh" },
    opening: "quote",
  },
  {
    id: "linen",
    name: "Linen",
    feel: "Small, calm type on linen, a terracotta banner box, the figures in a line under it.",
    look: "editorial",
    theme: { font_pair: "dm", heading_size: "compact", button_shape: "rounded", background_color: "#fbf7f2" },
    palette: { primary: "#c2410c" },
    hero: { layout: "full", background: "solid" },
    opening: "stats",
  },
  {
    id: "grid",
    name: "Grid",
    feel: "Sky blue and concrete grey, square everything, the work beside the headline and then in a row.",
    look: "bold",
    theme: { font_pair: "inter", heading_size: "large", button_shape: "square", background_color: "#f4f4f5" },
    palette: { primary: "#0369a1" },
    hero: { layout: "split", background: "grain" },
    opening: "gallery",
  },
  {
    id: "mono",
    name: "Mono",
    feel: "Charcoal on white, a plain grotesk kept small, the words centred, then the quote. Spare.",
    look: "classic",
    theme: { font_pair: "space", heading_size: "compact", button_shape: "square", background_color: "#ffffff" },
    palette: { primary: "#27272a" },
    hero: { layout: "centered", background: "solid" },
    opening: "quote",
  },

  // ── Fifteen more (2026-10-20), so every look comes six ways: three more banners, type and palettes on each.
  {
    id: "marquee",
    name: "Marquee",
    feel: "Poster type on a blush page, a short gradient banner, your story first. A show bill.",
    look: "classic",
    theme: { font_pair: "bebas", heading_size: "large", button_shape: "round", background_color: "#fff1f2" },
    palette: { primary: "#e11d48", accent: "#111111" },
    hero: { layout: "minimal", background: "gradient" },
    opening: "about",
  },
  {
    id: "harbor",
    name: "Harbor",
    feel: "Sea-glass page, a serif headline over a soft mesh, the work in a grid right under it.",
    look: "classic",
    theme: { font_pair: "playfair", heading_size: "normal", button_shape: "rounded", background_color: "#f0f9ff" },
    palette: { primary: "#0e7490" },
    hero: { layout: "full", background: "mesh" },
    opening: "gallery",
  },
  {
    id: "lemon",
    name: "Lemon",
    feel: "Butter-yellow page, mustard panel beside small bold type, square buttons, the quote first. Cheerful.",
    look: "classic",
    theme: { font_pair: "montserrat", heading_size: "compact", button_shape: "square", background_color: "#fefce8" },
    palette: { primary: "#ca8a04" },
    hero: { layout: "split", background: "solid" },
    opening: "quote",
  },
  {
    id: "ink",
    name: "Ink",
    feel: "Off-white paper, a heavy sans headline beside a grainy ink-blue panel, the work in a row. Printed.",
    look: "editorial",
    theme: { font_pair: "montserrat", heading_size: "large", button_shape: "square", background_color: "#f7f7f5" },
    palette: { primary: "#1e293b", accent: "#f59e0b" },
    hero: { layout: "split", background: "grain" },
    opening: "gallery",
  },
  {
    id: "rose",
    name: "Rose",
    feel: "Round friendly type centred over a rose gradient, blush paper, the numbers in a line. Warm.",
    look: "editorial",
    theme: { font_pair: "poppins", heading_size: "normal", button_shape: "round", background_color: "#fff1f2" },
    palette: { primary: "#be185d" },
    hero: { layout: "centered", background: "gradient" },
    opening: "stats",
  },
  {
    id: "sage",
    name: "Sage",
    feel: "Pale green paper, a small clean headline on a soft mesh, your story first. Calm.",
    look: "editorial",
    theme: { font_pair: "inter", heading_size: "compact", button_shape: "rounded", background_color: "#f1f5f0" },
    palette: { primary: "#15803d" },
    hero: { layout: "minimal", background: "mesh" },
    opening: "about",
  },
  {
    id: "neon",
    name: "Neon",
    feel: "Near-black page, poster type beside a cyan-to-pink gradient, square corners, the dates up front. A night out.",
    look: "cinematic",
    theme: { font_pair: "bebas", heading_size: "large", button_shape: "square", color_scheme: "dark", background_color: "#09090b" },
    palette: { primary: "#22d3ee", accent: "#f0abfc" },
    hero: { layout: "split", background: "gradient" },
    opening: "stats",
  },
  {
    id: "ember",
    name: "Ember",
    feel: "Deep brown-black, a bold sans over a grainy orange banner, pill buttons, the work first. Warm dark.",
    look: "cinematic",
    theme: { font_pair: "montserrat", heading_size: "large", button_shape: "round", color_scheme: "dark", background_color: "#1c0a00" },
    palette: { primary: "#f97316", accent: "#fdba74" },
    hero: { layout: "full", background: "grain" },
    opening: "gallery",
  },
  {
    id: "midnight",
    name: "Midnight",
    feel: "Navy dark, a bookish serif centred on a flat blue banner, your story first. Quiet and late.",
    look: "cinematic",
    theme: { font_pair: "lora", heading_size: "normal", button_shape: "rounded", color_scheme: "dark", background_color: "#0b1220" },
    palette: { primary: "#60a5fa", accent: "#bfdbfe" },
    hero: { layout: "centered", background: "solid" },
    opening: "about",
  },
  {
    id: "ticket",
    name: "Ticket",
    feel: "Cream page, a quirky grotesk centred on a flat amber banner, giant numbers on the black band. A ticket stub.",
    look: "bold",
    theme: { font_pair: "space", heading_size: "large", button_shape: "square", background_color: "#fffbeb" },
    palette: { primary: "#b45309", accent: "#111111" },
    hero: { layout: "centered", background: "solid" },
    opening: "stats",
  },
  {
    id: "signal",
    name: "Signal",
    feel: "White page, round friendly type over a green gradient banner, rounded corners, the quote first. Upbeat.",
    look: "bold",
    theme: { font_pair: "poppins", heading_size: "large", button_shape: "rounded", background_color: "#ffffff" },
    palette: { primary: "#16a34a" },
    hero: { layout: "full", background: "gradient" },
    opening: "quote",
  },
  {
    id: "chalk",
    name: "Chalk",
    feel: "Stone-grey page, a small serif headline on a flat charcoal strip, red buttons, the work first. Blackboard.",
    look: "bold",
    theme: { font_pair: "dm", heading_size: "compact", button_shape: "square", background_color: "#f5f5f4" },
    palette: { primary: "#44403c", accent: "#dc2626" },
    hero: { layout: "minimal", background: "solid" },
    opening: "gallery",
  },
  {
    id: "lagoon",
    name: "Lagoon",
    feel: "Ice-blue page, big round type on a short teal mesh banner, pill buttons, the numbers first. Fresh.",
    look: "split",
    theme: { font_pair: "poppins", heading_size: "large", button_shape: "round", background_color: "#ecfeff" },
    palette: { primary: "#0891b2" },
    hero: { layout: "minimal", background: "mesh" },
    opening: "stats",
  },
  {
    id: "clay",
    name: "Clay",
    feel: "Terracotta panel beside a bookish serif on peach paper, grainy, your story first. Earthy.",
    look: "split",
    theme: { font_pair: "lora", heading_size: "normal", button_shape: "rounded", background_color: "#fdf2e9" },
    palette: { primary: "#9a3412" },
    hero: { layout: "split", background: "grain" },
    opening: "about",
  },
  {
    id: "slate",
    name: "Slate",
    feel: "Cool grey page, poster type centred on a slate gradient, amber buttons, square corners, the quote first.",
    look: "split",
    theme: { font_pair: "bebas", heading_size: "large", button_shape: "square", background_color: "#f8fafc" },
    palette: { primary: "#334155", accent: "#f59e0b" },
    hero: { layout: "centered", background: "gradient" },
    opening: "quote",
  },
];

/** The theme fields a design sets on a new site. `own` is the starter's own design, which keeps the starter's colour
 * (`ownColor`) and lets the look derive its accent, exactly as before designs existed. */
export function designTheme(
  design: WebsiteDesign,
  ownColor: string,
  own: boolean
): Pick<ThemeConfig, "look" | "color_scheme" | "font_pair" | "heading_size" | "button_shape" | "background_color" | "primary_color" | "accent_color"> {
  return {
    look: design.look,
    // Set either way, so a light design on a dark look's site turns the dark page back off.
    color_scheme: design.theme.color_scheme ?? "light",
    font_pair: design.theme.font_pair,
    heading_size: design.theme.heading_size,
    button_shape: design.theme.button_shape,
    background_color: design.theme.background_color,
    primary_color: own ? ownColor : design.palette.primary,
    ...(own || !design.palette.accent ? {} : { accent_color: design.palette.accent }),
  };
}

/** The banner's layout and paint under a design. */
export function designHero(design: WebsiteDesign): Pick<HeroBlockConfig, "layout" | "background"> {
  return { layout: design.hero.layout, background: design.hero.background };
}
