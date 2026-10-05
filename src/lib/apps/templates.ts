import { defaultConfigFor } from "@/lib/builder/block-defaults";
import { isMapsBlock } from "@/lib/platform/maps-shared";
import type { BlockConfig, BlockType, ManifestConfig, ThemeConfig } from "@/types/database";

/**
 * Starter apps: what "New app" offers instead of an empty page. Each one is
 * a small, ready-to-publish app (pages, blocks, colours) the customer then
 * makes their own. Nothing here is stored; it's turned into rows when the
 * app is created (`buildStarter`).
 */

export type TemplateIcon = "briefcase" | "shopping-bag" | "calendar" | "utensils" | "fuel" | "mic" | "plus" | "dumbbell" | "sparkles" | "users";

export interface StarterTemplate {
  id: string;
  name: string;
  tagline: string;
  icon: TemplateIcon;
  /** Brand colour, used for the card, the app's theme and its install icon. */
  color: string;
  /** What the starter contains, as short chips on the card. */
  includes: string[];
  /** Which group the picker lists it under. */
  category: TemplateCategoryId;
}

export type TemplateCategoryId = "food" | "fitness" | "shops" | "venues" | "local" | "scratch";

/** The picker's groups, in the order they are shown. */
export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategoryId; name: string; blurb: string }> = [
  { id: "food", name: "Restaurants & cafés", blurb: "Menus, reservations and what's open now" },
  { id: "fitness", name: "Gyms & studios", blurb: "Class schedules and free-trial sign-ups" },
  { id: "shops", name: "Shops & services", blurb: "Sell products, take bookings, or just get found" },
  { id: "venues", name: "Venues, events & community", blurb: "Events people can book, and a home for your group" },
  { id: "local", name: "Local info", blurb: "Live data for the neighbourhood" },
  { id: "scratch", name: "Start from scratch", blurb: "Build exactly what you want" },
];

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "business",
    name: "Local business",
    tagline: "A home page and a contact form. Great for shops, salons and studios.",
    icon: "briefcase",
    color: "#6366f1",
    includes: ["Welcome", "Photo", "Contact form"],
    category: "shops",
  },
  {
    id: "store",
    name: "Online store",
    tagline: "Show your products and take orders from your customers' phones.",
    icon: "shopping-bag",
    color: "#10b981",
    includes: ["Welcome", "Product list"],
    category: "shops",
  },
  {
    id: "events",
    name: "Events & bookings",
    tagline: "A calendar people can book from. Classes, tastings, tours.",
    icon: "calendar",
    color: "#8b5cf6",
    includes: ["Welcome", "Event calendar"],
    category: "venues",
  },
  {
    id: "food",
    name: "Food finder",
    tagline: "Live open and closing-soon status for restaurants near each visitor.",
    icon: "utensils",
    color: "#f97316",
    includes: ["Live food directory"],
    category: "food",
  },
  {
    id: "gas",
    name: "Gas prices",
    tagline: "The cheapest gas near each visitor, with directions and community updates.",
    icon: "fuel",
    color: "#10b981",
    includes: ["Live gas prices"],
    category: "local",
  },
  {
    id: "openmic",
    name: "Open mic list",
    tagline: "What's on tonight, and a form for hosts to add theirs.",
    icon: "mic",
    color: "#f87171",
    includes: ["Mics today", "Submit form"],
    category: "venues",
  },
  {
    id: "restaurant",
    name: "Restaurant or café",
    tagline: "Your menu, opening hours and a way to reserve a table.",
    icon: "utensils",
    color: "#ea580c",
    includes: ["Welcome", "Menu", "Reservation form"],
    category: "food",
  },
  {
    id: "fitness",
    name: "Gym or studio",
    tagline: "Show your classes, let people book a spot, and collect free-trial sign-ups.",
    icon: "dumbbell",
    color: "#0ea5e9",
    includes: ["Welcome", "Class booking", "Free-trial form"],
    category: "fitness",
  },
  {
    id: "salon",
    name: "Salon or services",
    tagline: "List your services and let clients book an appointment.",
    icon: "sparkles",
    color: "#ec4899",
    includes: ["Welcome", "Services", "Booking", "Contact form"],
    category: "shops",
  },
  {
    id: "community",
    name: "Club or community",
    tagline: "A home for your group: news, upcoming events and a way to join.",
    icon: "users",
    color: "#14b8a6",
    includes: ["Welcome", "Events", "Join form"],
    category: "venues",
  },
  {
    id: "blank",
    name: "Start from scratch",
    tagline: "An empty app. Add exactly the blocks you want.",
    icon: "plus",
    color: "#64748b",
    includes: [],
    category: "scratch",
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
    case "restaurant":
      return {
        manifest,
        theme: {
          ...theme,
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Reserve", icon: "calendar", page_path: "reserve" },
          ],
        },
        pages: [
          home([
            welcome("Fresh food, made with care. See the menu, check our hours and save yourself a table."),
            block("text", {
              heading: "Our menu",
              body: "Starters\nAdd a dish, a short description and the price.\n\nMains\nAdd your best sellers here.\n\nDesserts\nSomething sweet to finish.",
            }),
            block("text", { heading: "Hours and address", body: "Open daily 11am to 9pm\n123 Main Street" }),
          ]),
          {
            name: "Reserve",
            path: "reserve",
            isHome: false,
            blocks: [
              block("contact_form", {
                title: "Reserve a table",
                submit_label: "Request a table",
                fields: [
                  { name: "name", label: "Your name", type: "text", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "details", label: "Day, time and number of people", type: "textarea", required: true },
                ],
              }),
            ],
          },
        ],
      };
    case "fitness":
      return {
        manifest,
        theme: {
          ...theme,
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Classes", icon: "calendar", page_path: "classes" },
            { label: "Join", icon: "mail", page_path: "join" },
          ],
        },
        pages: [
          home([
            welcome("Move more, feel better. Browse our classes and book your spot from your phone."),
            block("text", { heading: "What we offer", body: "Strength, yoga, cardio and more. Tell people what makes your classes different." }),
          ]),
          { name: "Classes", path: "classes", isHome: false, blocks: [block("event_calendar", { title: "Book a class" })] },
          {
            name: "Join",
            path: "join",
            isHome: false,
            blocks: [
              block("contact_form", {
                title: "Try a free class",
                submit_label: "Claim my free class",
                fields: [
                  { name: "name", label: "Your name", type: "text", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "goal", label: "What are you hoping to get out of it?", type: "textarea" },
                ],
              }),
            ],
          },
        ],
      };
    case "salon":
      return {
        manifest,
        theme: {
          ...theme,
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Book", icon: "calendar", page_path: "book" },
            { label: "Contact", icon: "mail", page_path: "contact" },
          ],
        },
        pages: [
          home([
            welcome("Look and feel your best. See what we offer and book your next appointment."),
            block("text", { heading: "Services", body: "Add each service with how long it takes and the price.\n\nHaircut\nColour\nStyling" }),
          ]),
          { name: "Book", path: "book", isHome: false, blocks: [block("event_calendar", { title: "Book an appointment" })] },
          {
            name: "Contact",
            path: "contact",
            isHome: false,
            blocks: [block("contact_form", { title: "Questions? Ask us", submit_label: "Send message", fields: CONTACT_FIELDS })],
          },
        ],
      };
    case "community":
      return {
        manifest,
        theme: {
          ...theme,
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Events", icon: "calendar", page_path: "events" },
            { label: "Join", icon: "mail", page_path: "join" },
          ],
        },
        pages: [
          home([welcome("News, meetups and everything happening in our community, in one place.")]),
          { name: "Events", path: "events", isHome: false, blocks: [block("event_calendar", { title: "What's coming up" })] },
          {
            name: "Join",
            path: "join",
            isHome: false,
            blocks: [
              block("contact_form", {
                title: "Join us",
                submit_label: "Count me in",
                fields: [
                  { name: "name", label: "Your name", type: "text", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                ],
              }),
            ],
          },
        ],
      };
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
