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
    tagline: "A beautiful little shop with sample products, card payments and pickup info.",
    icon: "shopping-bag",
    color: "#a16207",
    includes: ["Photo banner", "Products", "Gallery", "Reviews", "Hours"],
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
    tagline: "Mouth-watering photos, your full menu, hours and table reservations.",
    icon: "utensils",
    color: "#c2410c",
    includes: ["Photo banner", "Menu", "Gallery", "Reviews", "Hours", "Reservations"],
    category: "food",
  },
  {
    id: "fitness",
    name: "Gym or studio",
    tagline: "A bold, dark look with your classes, memberships and free-trial sign-ups.",
    icon: "dumbbell",
    color: "#e11d48",
    includes: ["Photo banner", "Class booking", "Memberships", "Gallery", "Reviews", "Free trial"],
    category: "fitness",
  },
  {
    id: "salon",
    name: "Salon or services",
    tagline: "An elegant look with your services and prices, gallery, reviews and online booking.",
    icon: "sparkles",
    color: "#be185d",
    includes: ["Photo banner", "Services & prices", "Booking", "Gallery", "Reviews"],
    category: "shops",
  },
  {
    id: "community",
    name: "Club or community",
    tagline: "A warm home for your group: upcoming events, photos and a free sign-up.",
    icon: "users",
    color: "#0f766e",
    includes: ["Photo banner", "Events", "Gallery", "Reviews", "Join form"],
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
/** A sample event created with the app, so a booking page isn't empty on first open. */
export interface StarterEvent {
  title: string;
  description: string;
  /** Days from today (0 = today). */
  dayOffset: number;
  /** Local start time, "HH:MM". */
  time: string;
  minutes: number;
  capacity: number;
}

/** A sample product created with the app, so a shop isn't empty on first open. */
export interface StarterProduct {
  name: string;
  description: string;
  priceCents: number;
  image: string;
}

export interface Starter {
  theme: ThemeConfig;
  manifest: ManifestConfig;
  pages: StarterPage[];
  events?: StarterEvent[];
  products?: StarterProduct[];
}

/** A photo that ships with TapAndLaunch (public/templates), as a full address so it also loads inside customers' apps. */
export function templatePhoto(name: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const local = /^(localhost|127\.|\d{1,3}(\.\d{1,3}){3})/.test(root);
  return `${local ? "http" : "https"}://${root}/templates/${name}.jpg`;
}

const SAMPLE_NOTE = "This is a sample. Edit it or delete it under Manage, Events.";

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
        manifest: { ...manifest, background_color: "#faf7f2" },
        theme: {
          ...theme,
          background_color: "#faf7f2",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Shop", icon: "shop", page_path: "shop" },
            { label: "Contact", icon: "mail", page_path: "contact" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("store-hero"),
              eyebrow: "Small batch · Made by hand",
              headline: "Little things that make a home.",
              subtext: "Hand-poured candles and home goods, made in small batches in our studio.",
              button_label: "Shop now",
              button_page: "shop",
            }),
            block("stats", {
              items: [
                { value: "100%", label: "Natural soy wax" },
                { value: "Free", label: "Local pickup" },
                { value: "4.9★", label: "From 300+ orders" },
              ],
            }),
            block("product_list", { title: "Bestsellers" }),
            block("gallery", {
              title: "From the studio",
              images: [
                { src: templatePhoto("store-shop"), alt: "Shelves of products in our shop" },
                { src: templatePhoto("store-amber"), alt: "A candle glowing in an amber jar" },
                { src: templatePhoto("store-set"), alt: "A set of scented candles on a wooden table" },
              ],
            }),
            block("reviews", {
              title: "Loved by customers",
              items: [
                { quote: "The cedar candle makes my whole apartment smell amazing. Already ordered two more.", name: "Hannah L.", rating: 5 },
                { quote: "Beautiful packaging, perfect gift. Picked it up the same day.", name: "Marcus P.", rating: 5 },
                { quote: "Burns clean and lasts forever. My favourite little shop.", name: "Ana R.", rating: 5 },
              ],
            }),
          ]),
          { name: "Shop", path: "shop", isHome: false, blocks: [block("text", { heading: "Shop everything", body: "Order from your phone and pay by card, or pick up for free at the studio." }), block("product_list", { title: "All products" })] },
          {
            name: "Contact",
            path: "contact",
            isHome: false,
            blocks: [
              block("hours", {
                title: "Studio hours",
                rows: [
                  { label: "Wed to Fri", value: "11am to 6pm" },
                  { label: "Saturday", value: "10am to 5pm" },
                  { label: "Sun to Tue", value: "Closed" },
                ],
                address: "",
                phone: "",
              }),
              block("contact_form", { title: "Questions or custom orders?", submit_label: "Send message", fields: CONTACT_FIELDS }),
            ],
          },
        ],
        products: [
          { name: "Cedar & Smoke candle", description: "Warm cedarwood and a hint of campfire. 8 oz, about 45 hours. (Sample product: edit it under Manage, Products.)", priceCents: 2800, image: templatePhoto("store-amber") },
          { name: "Gift set of four", description: "Four mini candles in our bestselling scents, ready to give. (Sample product.)", priceCents: 4800, image: templatePhoto("store-giftset") },
          { name: "Sunday Morning candle", description: "Fresh linen and orange blossom. 8 oz, about 45 hours. (Sample product.)", priceCents: 2600, image: templatePhoto("store-set") },
        ],
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
        manifest: { ...manifest, background_color: "#fff8f1" },
        theme: {
          ...theme,
          background_color: "#fff8f1",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Menu", icon: "info", page_path: "menu" },
            { label: "Reserve", icon: "calendar", page_path: "reserve" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("restaurant-hero"),
              eyebrow: "Fresh · Local · Made to order",
              headline: "Good food, made with love.",
              subtext: "Tacos, bowls and fresh salsas, made from scratch every morning.",
              button_label: "Reserve a table",
              button_page: "reserve",
            }),
            block("stats", {
              items: [
                { value: "Daily", label: "Fresh salsas" },
                { value: "15 min", label: "Pickup orders" },
                { value: "Family", label: "Run since 2019" },
              ],
            }),
            block("gallery", {
              title: "Come hungry",
              images: [
                { src: templatePhoto("restaurant-room"), alt: "Our dining room with warm string lights" },
                { src: templatePhoto("restaurant-latte"), alt: "A latte on a bright orange table" },
                { src: templatePhoto("restaurant-cafe"), alt: "A cozy corner of the café" },
              ],
            }),
            block("reviews", {
              title: "Regulars say it best",
              items: [
                { quote: "The carnitas tacos are the best in the neighbourhood. We come every Friday.", name: "Maria G.", rating: 5 },
                { quote: "Friendly staff, quick lunch, and the salsa bar is unreal.", name: "Daniel K.", rating: 5 },
                { quote: "Booked a table for 8 from the app in a minute. Loved it.", name: "Priya S.", rating: 5 },
              ],
            }),
            block("hours", {
              title: "Hours",
              rows: [
                { label: "Mon to Thu", value: "11am to 9pm" },
                { label: "Fri and Sat", value: "11am to 10pm" },
                { label: "Sunday", value: "10am to 3pm (brunch)" },
              ],
              address: "",
              phone: "",
            }),
          ]),
          {
            name: "Menu",
            path: "menu",
            isHome: false,
            blocks: [
              block("price_list", {
                title: "Menu",
                subtitle: "Everything is made fresh. Ask us about gluten-free and vegan options.",
                sections: [
                  {
                    name: "Tacos",
                    items: [
                      { name: "Carnitas", description: "Slow-cooked pork, pickled onion, cilantro", price: "$4.50", badge: "Popular" },
                      { name: "Baja fish", description: "Crispy cod, chipotle crema, cabbage slaw", price: "$5.00" },
                      { name: "Roasted cauliflower", description: "Pepita salsa, lime, queso fresco", price: "$4.00", badge: "Veggie" },
                    ],
                  },
                  {
                    name: "Bowls & salads",
                    items: [
                      { name: "Burrito bowl", description: "Rice, black beans, your choice of protein, all the toppings", price: "$13" },
                      { name: "Street corn salad", description: "Charred corn, cotija, lime, chili", price: "$9" },
                    ],
                  },
                  {
                    name: "Drinks",
                    items: [
                      { name: "Horchata", description: "House-made, cinnamon and rice", price: "$4" },
                      { name: "Latte", description: "Double shot, any milk", price: "$5" },
                    ],
                  },
                ],
              }),
            ],
          },
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
        manifest: { ...manifest, background_color: "#0a0a0a" },
        theme: {
          ...theme,
          color_scheme: "dark",
          background_color: "#0a0a0a",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Classes", icon: "calendar", page_path: "classes" },
            { label: "Join", icon: "user", page_path: "join" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("gym-hero"),
              eyebrow: "Strength · Yoga · Martial arts",
              headline: "Stronger every week.",
              subtext: "Coached classes for every level, from first-timers to competitors. Your first class is on us.",
              button_label: "Book a free class",
              button_page: "classes",
            }),
            block("stats", {
              items: [
                { value: "20+", label: "Classes a week" },
                { value: "All", label: "Levels welcome" },
                { value: "1st", label: "Class free" },
              ],
            }),
            block("price_list", {
              title: "Memberships",
              subtitle: "No sign-up fees. Pause or cancel any time.",
              sections: [
                {
                  name: "Plans",
                  items: [
                    { name: "Drop-in class", description: "Any class, no commitment", price: "$20" },
                    { name: "10-class pass", description: "Use within 3 months", price: "$170", badge: "Save 15%" },
                    { name: "Unlimited", description: "Every class, every week", price: "$129/mo", badge: "Most popular" },
                  ],
                },
              ],
            }),
            block("gallery", {
              title: "Inside the studio",
              images: [
                { src: templatePhoto("gym-yoga"), alt: "A member stretching on a yoga mat" },
                { src: templatePhoto("gym-karate"), alt: "A young student in a karate uniform" },
                { src: templatePhoto("gym-weights"), alt: "A rack of dumbbells" },
              ],
            }),
            block("reviews", {
              title: "Members say",
              items: [
                { quote: "I was nervous to start, but the coaches made my first class feel easy. Six months in and I'm hooked.", name: "Jordan T.", rating: 5 },
                { quote: "My kids love their karate class, and I love that I can book it from my phone.", name: "Alicia M.", rating: 5 },
                { quote: "Best community in town. The 6am crew keeps me honest.", name: "Sam R.", rating: 5 },
              ],
            }),
            block("hours", {
              title: "Hours",
              rows: [
                { label: "Mon to Fri", value: "6am to 9pm" },
                { label: "Saturday", value: "8am to 4pm" },
                { label: "Sunday", value: "9am to 1pm" },
              ],
              address: "",
              phone: "",
            }),
          ]),
          {
            name: "Classes",
            path: "classes",
            isHome: false,
            blocks: [
              block("text", { heading: "Book a class", body: "Pick a class and save your spot. New here? Your first class is free." }),
              block("event_calendar", { title: "This week" }),
            ],
          },
          {
            name: "Join",
            path: "join",
            isHome: false,
            blocks: [
              block("hero", {
                image_url: templatePhoto("gym-karate"),
                eyebrow: "New members",
                headline: "Your first class is free.",
                subtext: "Tell us a little about you and we'll save you a spot.",
              }),
              block("contact_form", {
                title: "Claim your free class",
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
        events: [
          { title: "Morning Strength", description: `Full-body strength with a coach. All levels. ${SAMPLE_NOTE}`, dayOffset: 1, time: "06:30", minutes: 45, capacity: 16 },
          { title: "Beginner Karate (kids 7 to 12)", description: `Fun, focused and safe. Uniforms not needed for your first class. ${SAMPLE_NOTE}`, dayOffset: 1, time: "17:30", minutes: 50, capacity: 14 },
          { title: "Vinyasa Yoga", description: `Flow, breathe and stretch. Mats provided. ${SAMPLE_NOTE}`, dayOffset: 2, time: "18:00", minutes: 60, capacity: 20 },
          { title: "HIIT 30", description: `Thirty minutes, all out. ${SAMPLE_NOTE}`, dayOffset: 3, time: "12:15", minutes: 30, capacity: 18 },
          { title: "Adult Karate", description: `Technique, sparring drills and conditioning. ${SAMPLE_NOTE}`, dayOffset: 4, time: "19:00", minutes: 60, capacity: 16 },
          { title: "Weekend Bootcamp", description: `Bring a friend. Outdoor if the weather is good. ${SAMPLE_NOTE}`, dayOffset: 5, time: "09:00", minutes: 60, capacity: 24 },
        ],
      };
    case "salon":
      return {
        manifest: { ...manifest, background_color: "#fdf6f4" },
        theme: {
          ...theme,
          background_color: "#fdf6f4",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Services", icon: "info", page_path: "services" },
            { label: "Book", icon: "calendar", page_path: "book" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("salon-hero"),
              eyebrow: "Hair · Colour · Styling",
              headline: "Leave feeling like you.",
              subtext: "Cuts, colour and styling by a team that listens first. Book in seconds from your phone.",
              button_label: "Book an appointment",
              button_page: "book",
            }),
            block("stats", {
              items: [
                { value: "4.9★", label: "200+ reviews" },
                { value: "12 yrs", label: "Experience" },
                { value: "Same", label: "Week booking" },
              ],
            }),
            block("gallery", {
              title: "Inside the salon",
              images: [
                { src: templatePhoto("salon-interior"), alt: "Our bright salon with round mirrors" },
                { src: templatePhoto("salon-blowdry"), alt: "A stylist giving a blow-dry" },
                { src: templatePhoto("salon-wash"), alt: "A relaxing hair wash" },
              ],
            }),
            block("reviews", {
              title: "Happy clients",
              items: [
                { quote: "Best colour I've ever had. They actually listened to what I wanted.", name: "Chloe W.", rating: 5 },
                { quote: "Booked from the app on my lunch break and was in the chair two days later.", name: "Tasha B.", rating: 5 },
                { quote: "Relaxing, friendly and my cut still looks great a month later.", name: "Emily J.", rating: 5 },
              ],
            }),
            block("hours", {
              title: "Hours",
              rows: [
                { label: "Tue to Fri", value: "10am to 7pm" },
                { label: "Saturday", value: "9am to 5pm" },
                { label: "Sun and Mon", value: "Closed" },
              ],
              address: "",
              phone: "",
            }),
          ]),
          {
            name: "Services",
            path: "services",
            isHome: false,
            blocks: [
              block("price_list", {
                title: "Services",
                subtitle: "Prices are a starting point and depend on hair length. We'll confirm at your consultation.",
                sections: [
                  {
                    name: "Cuts",
                    items: [
                      { name: "Women's cut & style", description: "Wash, cut and blow-dry, about 60 minutes", price: "from $65", badge: "Popular" },
                      { name: "Men's cut", description: "Wash, cut and style, about 30 minutes", price: "from $40" },
                      { name: "Kids' cut", description: "Under 12", price: "$30" },
                    ],
                  },
                  {
                    name: "Colour",
                    items: [
                      { name: "Full colour", description: "Root to tip, includes toner", price: "from $110" },
                      { name: "Balayage", description: "Hand-painted, natural-looking highlights", price: "from $180", badge: "Signature" },
                      { name: "Root touch-up", description: "Up to 6 weeks of regrowth", price: "from $75" },
                    ],
                  },
                  {
                    name: "Styling",
                    items: [
                      { name: "Blow-dry", description: "Smooth, bouncy or beach waves", price: "$45" },
                      { name: "Event hair", description: "Weddings, parties and photoshoots", price: "from $85" },
                    ],
                  },
                ],
              }),
            ],
          },
          {
            name: "Book",
            path: "book",
            isHome: false,
            blocks: [
              block("text", { heading: "Book an appointment", body: "Pick a time that suits you. Need something different? Send us a message below." }),
              block("event_calendar", { title: "Open appointments" }),
              block("contact_form", { title: "Ask a question", submit_label: "Send message", fields: CONTACT_FIELDS }),
            ],
          },
        ],
        events: [
          { title: "Cut & style with Mia", description: `60 minutes. ${SAMPLE_NOTE}`, dayOffset: 1, time: "10:00", minutes: 60, capacity: 1 },
          { title: "Colour consultation", description: `Free, 20 minutes. Find the right shade for you. ${SAMPLE_NOTE}`, dayOffset: 1, time: "14:30", minutes: 20, capacity: 1 },
          { title: "Balayage with Jordan", description: `About 3 hours. ${SAMPLE_NOTE}`, dayOffset: 2, time: "11:00", minutes: 180, capacity: 1 },
          { title: "Blow-dry", description: `45 minutes. ${SAMPLE_NOTE}`, dayOffset: 3, time: "16:00", minutes: 45, capacity: 1 },
          { title: "Men's cut with Leo", description: `30 minutes. ${SAMPLE_NOTE}`, dayOffset: 4, time: "12:00", minutes: 30, capacity: 1 },
        ],
      };
    case "community":
      return {
        manifest: { ...manifest, background_color: "#f3faf8" },
        theme: {
          ...theme,
          background_color: "#f3faf8",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Events", icon: "calendar", page_path: "events" },
            { label: "Join", icon: "user", page_path: "join" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("community-hero"),
              eyebrow: "Neighbours · Friends · Volunteers",
              headline: "Better together.",
              subtext: "Meetups, workshops and good causes, all in one place. Everyone is welcome.",
              button_label: "See what's on",
              button_page: "events",
            }),
            block("stats", {
              items: [
                { value: "250+", label: "Members" },
                { value: "4", label: "Events a month" },
                { value: "Free", label: "To join" },
              ],
            }),
            block("text", {
              heading: "What we're about",
              body: "We're a friendly group of neighbours who like to meet, learn and help out. Come to one event, bring a friend, and stay as long as you like.",
            }),
            block("gallery", {
              title: "Recent gatherings",
              images: [
                { src: templatePhoto("community-workshop"), alt: "Members at a hands-on workshop" },
                { src: templatePhoto("community-market"), alt: "Neighbours chatting at a market day" },
                { src: templatePhoto("community-volunteers"), alt: "Volunteers at a community drive" },
              ],
            }),
            block("reviews", {
              title: "Why members stay",
              items: [
                { quote: "I moved here not knowing anyone. Six months later this group feels like family.", name: "Rosa D.", rating: 5 },
                { quote: "The book circle is the highlight of my month.", name: "Ken O.", rating: 5 },
                { quote: "Easy to find out what's on and sign up right from my phone.", name: "Liz M.", rating: 5 },
              ],
            }),
          ]),
          {
            name: "Events",
            path: "events",
            isHome: false,
            blocks: [
              block("text", { heading: "Coming up", body: "Save your spot so we know how many to expect." }),
              block("event_calendar", { title: "Upcoming events" }),
            ],
          },
          {
            name: "Join",
            path: "join",
            isHome: false,
            blocks: [
              block("hero", {
                image_url: templatePhoto("community-books"),
                eyebrow: "Membership is free",
                headline: "Come join us.",
                subtext: "Get news and event reminders. No commitment, ever.",
              }),
              block("contact_form", {
                title: "Join the community",
                submit_label: "Count me in",
                fields: [
                  { name: "name", label: "Your name", type: "text", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "interests", label: "What are you interested in?", type: "textarea" },
                ],
              }),
            ],
          },
        ],
        events: [
          { title: "Monthly book circle", description: `This month: anything you loved reading lately. ${SAMPLE_NOTE}`, dayOffset: 2, time: "19:00", minutes: 90, capacity: 20 },
          { title: "Saturday park clean-up", description: `Gloves and bags provided. Coffee after. ${SAMPLE_NOTE}`, dayOffset: 5, time: "10:00", minutes: 120, capacity: 40 },
          { title: "Wreath-making workshop", description: `All materials included. ${SAMPLE_NOTE}`, dayOffset: 9, time: "18:30", minutes: 120, capacity: 16 },
          { title: "Neighbourhood potluck", description: `Bring a dish to share. Families welcome. ${SAMPLE_NOTE}`, dayOffset: 13, time: "17:00", minutes: 180, capacity: 60 },
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
