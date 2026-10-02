import { defaultConfigFor } from "@/lib/builder/block-defaults";
import { isMapsBlock } from "@/lib/platform/maps-shared";
import type { BlockConfig, BlockType, ManifestConfig, ThemeConfig } from "@/types/database";

/**
 * Starter apps: what "New app" offers instead of an empty page. Each one is
 * a small, ready-to-publish app (pages, blocks, colours) the customer then
 * makes their own. Nothing here is stored; it's turned into rows when the
 * app is created (`buildStarter`).
 */

export type TemplateIcon = "briefcase" | "shopping-bag" | "calendar" | "utensils" | "fuel" | "mic" | "plus";

export interface StarterTemplate {
  id: string;
  name: string;
  tagline: string;
  icon: TemplateIcon;
  /** Brand colour, used for the card, the app's theme and its install icon. */
  color: string;
  /** What the starter contains, as short chips on the card. */
  includes: string[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "business",
    name: "Local business",
    tagline: "A home page and a contact form. Great for shops, salons and studios.",
    icon: "briefcase",
    color: "#6366f1",
    includes: ["Welcome", "Photo", "Contact form"],
  },
  {
    id: "store",
    name: "Online store",
    tagline: "Show your products and take orders from your customers' phones.",
    icon: "shopping-bag",
    color: "#10b981",
    includes: ["Welcome", "Product list"],
  },
  {
    id: "events",
    name: "Events & bookings",
    tagline: "A calendar people can book from. Classes, tastings, tours.",
    icon: "calendar",
    color: "#8b5cf6",
    includes: ["Welcome", "Event calendar"],
  },
  {
    id: "food",
    name: "Food finder",
    tagline: "Live open and closing-soon status for restaurants near each visitor.",
    icon: "utensils",
    color: "#f97316",
    includes: ["Live food directory"],
  },
  {
    id: "gas",
    name: "Gas prices",
    tagline: "The cheapest gas near each visitor, with directions and community updates.",
    icon: "fuel",
    color: "#10b981",
    includes: ["Live gas prices"],
  },
  {
    id: "openmic",
    name: "Open mic list",
    tagline: "What's on tonight, and a form for hosts to add theirs.",
    icon: "mic",
    color: "#f87171",
    includes: ["Mics today", "Submit form"],
  },
  {
    id: "blank",
    name: "Start from scratch",
    tagline: "An empty app. Add exactly the blocks you want.",
    icon: "plus",
    color: "#64748b",
    includes: [],
  },
];

export const DEFAULT_TEMPLATE_ID = "blank";

/** Does this starter use Google Maps (Live food, Gas prices)? */
export function templateNeedsMaps(id: string): boolean {
  return buildStarter(id, "x").pages.some((p) => p.blocks.some((b) => isMapsBlock(b.type)));
}

export function isTemplateId(id: string): boolean {
  return STARTER_TEMPLATES.some((t) => t.id === id);
}

export interface StarterBlock {
  type: BlockType;
  config: BlockConfig;
}
export interface StarterPage {
  name: string;
  path: string;
  isHome: boolean;
  blocks: StarterBlock[];
}
export interface Starter {
  theme: ThemeConfig;
  manifest: ManifestConfig;
  pages: StarterPage[];
}

const block = (type: BlockType, overrides: Record<string, unknown> = {}): StarterBlock => ({
  type,
  config: { ...defaultConfigFor(type), ...overrides } as BlockConfig,
});

const CONTACT_FIELDS = [
  { name: "name", label: "Your name", type: "text", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "message", label: "Message", type: "textarea" },
];

/** The rows for a new app of this template, named `appName`. Every starter
 * begins with the app's name in the header bar. */
export function buildStarter(templateId: string, appName: string): Starter {
  const starter = buildStarterBody(templateId, appName);
  return { ...starter, theme: { ...starter.theme, header_title: appName } };
}

function buildStarterBody(templateId: string, appName: string): Starter {
  const template = STARTER_TEMPLATES.find((t) => t.id === templateId) ?? STARTER_TEMPLATES[STARTER_TEMPLATES.length - 1];
  const manifest: ManifestConfig = {
    name: appName,
    short_name: appName.slice(0, 12),
    theme_color: template.color,
    display: "standalone",
  };
  const theme: ThemeConfig = { primary_color: template.color };
  const welcome = (body: string) => block("text", { heading: `Welcome to ${appName}`, body });
  const home = (blocks: StarterBlock[]): StarterPage => ({ name: "Home", path: "home", isHome: true, blocks });

  switch (template.id) {
    case "business":
      return {
        manifest,
        theme: {
          ...theme,
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Contact", icon: "mail", page_path: "contact" },
          ],
        },
        pages: [
          home([
            welcome("Tell people what you do, where to find you, and why they should stop by. Change this text any time."),
            block("image", { src: "", alt: `${appName}` }),
          ]),
          {
            name: "Contact",
            path: "contact",
            isHome: false,
            blocks: [block("contact_form", { title: "Get in touch", submit_label: "Send message", fields: CONTACT_FIELDS })],
          },
        ],
      };
    case "store":
      return {
        manifest,
        theme,
        pages: [home([welcome("Browse what we have and order right from your phone."), block("product_list", { title: "Shop" })])],
      };
    case "events":
      return {
        manifest,
        theme,
        pages: [home([welcome("See what's coming up and save your spot."), block("event_calendar", { title: "Upcoming events" })])],
      };
    case "food":
      return { manifest, theme, pages: [home([block("food_directory")])] };
    case "gas":
      return { manifest, theme, pages: [home([block("gas_directory")])] };
    case "openmic":
      return {
        manifest,
        theme: {
          ...theme,
          color_scheme: "dark",
          background_color: "#09090b",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Add your mic", icon: "plus", page_path: "add-mic" },
          ],
        },
        pages: [
          home([block("listing_directory")]),
          {
            name: "Add your mic",
            path: "add-mic",
            isHome: false,
            blocks: [
              block("contact_form", {
                title: "Submit your open mic",
                submit_label: "Send it in",
                fields: [
                  { name: "mic_name", label: "Open mic name", type: "text", required: true },
                  { name: "venue", label: "Venue and address", type: "text", required: true },
                  { name: "schedule", label: "Day and time", type: "text", required: true },
                  { name: "email", label: "Your email", type: "email", required: true },
                ],
              }),
            ],
          },
        ],
      };
    default:
      return { manifest, theme: {}, pages: [home([])] };
  }
}
