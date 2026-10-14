import type { HeroBlockConfig, ThemeConfig } from "@/types/database";

/**
 * A look is how a website is put together, beyond its two colours: how the banner is laid out, how the highlights,
 * reviews and newsletter are drawn, how the header sits. Five of them, each a real preset of the site-wide controls
 * App settings > Theme already offers (fonts, heading size, button shape, page background, dark or light) plus the
 * structural choices only a look makes. Sixteen sites in the same font on the same white with the same boxes looked
 * like a factory; a look is what makes Weddings and Technology feel like different places before a word changes.
 *
 * The look lives in `theme.look`. Nothing is inferred from fonts, so an app owner who picks a serif keeps the
 * classic layout unless they also pick a look. Unset means classic, which is exactly what every site looked like
 * before looks existed.
 */
export type LookId = "classic" | "editorial" | "cinematic" | "bold" | "split";

export const LOOK_IDS: LookId[] = ["classic", "editorial", "cinematic", "bold", "split"];

export type HeroLayout = NonNullable<HeroBlockConfig["layout"]>;
export type HeroBackground = NonNullable<HeroBlockConfig["background"]>;

export interface Look {
  name: string;
  /** One line that says what it is like, for the picker in App settings. */
  feel: string;
  /** The site-wide controls the look sets when chosen; the owner can change any of them afterwards. */
  theme: Pick<ThemeConfig, "font_pair" | "color_scheme" | "background_color" | "button_shape" | "heading_size">;
  /** How the banner is laid out and painted unless the banner itself says otherwise. */
  hero: { layout: HeroLayout; background: HeroBackground };
  /** The quote opens the Home page (after the banner) instead of closing About. */
  quoteOnHome?: boolean;
}

export const LOOKS: Record<LookId, Look> = {
  classic: {
    name: "Classic",
    feel: "Clean and direct: a colour banner, tidy tiles, pill buttons.",
    theme: { font_pair: "inter", background_color: "#fafafa", button_shape: "round", heading_size: "normal" },
    hero: { layout: "full", background: "solid" },
  },
  editorial: {
    name: "Editorial",
    feel: "Serif headlines on warm paper, a centred banner, a pull quote. Like a magazine.",
    theme: { font_pair: "playfair", background_color: "#faf6ef", button_shape: "rounded", heading_size: "large" },
    hero: { layout: "centered", background: "solid" },
    quoteOnHome: true,
  },
  cinematic: {
    name: "Cinematic",
    feel: "A dark site with the colour as light: a slow-moving banner, glass cards.",
    theme: { font_pair: "space", color_scheme: "dark", background_color: "#0a0a0a", button_shape: "rounded", heading_size: "large" },
    hero: { layout: "full", background: "mesh" },
  },
  bold: {
    name: "Bold",
    feel: "Poster headlines, square corners, giant numbers on a black band.",
    theme: { font_pair: "bebas", background_color: "#fffdf7", button_shape: "square", heading_size: "large" },
    hero: { layout: "full", background: "grain" },
  },
  split: {
    name: "Split",
    feel: "The headline beside the work, soft tinted panels.",
    theme: { font_pair: "dm", background_color: "#f6f6fb", button_shape: "round", heading_size: "normal" },
    hero: { layout: "split", background: "gradient" },
  },
};

/** The look a theme has. Unset or unknown is classic. */
export function lookOf(theme: ThemeConfig | undefined): LookId {
  const look = theme?.look;
  return look && look in LOOKS ? look : "classic";
}

/** The theme fields choosing a look sets, including the look itself. */
export function lookTheme(look: LookId): Pick<ThemeConfig, "look" | "font_pair" | "color_scheme" | "background_color" | "button_shape" | "heading_size"> {
  // `color_scheme` is set explicitly either way, so moving off Cinematic turns the dark page back off.
  return { look, color_scheme: "light", ...LOOKS[look].theme };
}

/** How a banner is laid out: its own choice first, then its look's default. */
export function heroLayout(config: HeroBlockConfig, look: LookId): HeroLayout {
  return config.layout ?? LOOKS[look].hero.layout;
}

export function heroBackground(config: HeroBlockConfig, look: LookId): HeroBackground {
  return config.background ?? LOOKS[look].hero.background;
}

export const HERO_LAYOUTS: Record<HeroLayout, string> = {
  full: "Full-width box, words at the bottom",
  centered: "Centred words, no box",
  split: "Words beside a panel",
  minimal: "Just a very big headline",
};

export const HERO_BACKGROUNDS: Record<HeroBackground, string> = {
  solid: "Your colour",
  gradient: "Your colour, shaded",
  mesh: "Dark, with your colour as light",
  grain: "Shaded, with a film grain",
};
