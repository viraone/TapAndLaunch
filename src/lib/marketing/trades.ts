import { LISTED_PRICE } from "@/lib/marketing";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { STARTER_TEMPLATES, WEBSITE_TOPICS, buildStarter, topicExtras, websiteDesigns, type StarterTemplate, type WebsiteTopic } from "@/lib/apps/templates";
import type { BlockType } from "@/types/database";

/**
 * One public page per trade (`/for/photographers`): what someone searching for "website for a photographer" lands on.
 * Everything on a page comes from the trade's own starter in lib/apps/templates.ts (its words, its preview, the
 * sections it really has), so a page can never promise something the template does not do, and a new topic gets its
 * page without anyone writing one.
 */
export interface TradePage {
  /** The address: /for/<slug>. */
  slug: string;
  /** The starter it is built from. */
  template: StarterTemplate;
  topic: WebsiteTopic;
  /** "photographers": who the page is for, in their own word. */
  people: string;
  /** The <title>, under 60 characters. */
  title: string;
  /** The meta description, under 160 characters. */
  description: string;
  headline: string;
  /** What the starter really includes, in plain phrases, in page order. */
  includes: string[];
  /** The chips the picker shows for the trade (Gallery, Bookings…). */
  extras: string[];
  designCount: number;
}

/** Who each trade's page speaks to. Written once, by hand: the one thing the starter data does not say. */
const PEOPLE: Record<string, string> = {
  entertainment: "comedy clubs and live venues",
  comedians: "stand-up comedians",
  photography: "photographers",
  design: "designers",
  education: "tutors and teachers",
  consulting: "consultants",
  art: "artists",
  health: "health practitioners",
  marketing: "marketing agencies",
  technology: "software and IT businesses",
  construction: "builders and trades",
  apparel: "clothing brands",
  music: "musicians and DJs",
  realestate: "real estate agents",
  beauty: "beauty and makeup artists",
  travel: "tour guides and travel businesses",
  weddings: "wedding planners",
};

const SLUGS: Record<string, string> = { realestate: "real-estate" };

/** What a section is, in words a business owner uses. Sections with nothing to say for a visitor are left out. */
const PHRASES: Partial<Record<BlockType, string>> = {
  hero: "a banner with your name and a button",
  stats: "three highlights",
  image_text: "a photo beside your story",
  gallery: "a photo gallery",
  video: "a video",
  audio: "an audio player",
  price_list: "a services and prices list",
  product_list: "a shop that takes card payments",
  event_calendar: "bookings people make online",
  map: "a map",
  faq: "answers to common questions",
  hours: "opening hours and area",
  reviews: "testimonials",
  newsletter: "a newsletter sign-up",
  contact_form: "a contact form",
};

/** "a gallery, bookings and a video" for the description; the plain shape when a trade has no extras. */
function describeExtras(extras: string[]): string {
  const words: Record<string, string> = { Gallery: "a gallery", Video: "a video", Audio: "audio", Prices: "prices", Shop: "a shop", Map: "a map", Bookings: "bookings", FAQ: "answers", Hours: "hours" };
  const list = extras.slice(0, 3).map((e) => words[e] ?? e.toLowerCase());
  if (!list.length) return "your story, highlights and a contact page";
  return list.length === 1 ? `${list[0]} and your story` : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

function includesOf(topic: WebsiteTopic): string[] {
  const starter = buildStarter(topic.id, "x");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const page of starter.pages) {
    for (const block of page.blocks) {
      const phrase = PHRASES[block.type];
      if (phrase && !seen.has(phrase)) {
        seen.add(phrase);
        out.push(phrase);
      }
    }
  }
  const pageNames = starter.pages.filter((p) => !p.isHome).map((p) => p.name);
  if (pageNames.length) out.push(`${pageNames.join(" and ")} pages`);
  return out;
}

export const TRADE_PAGES: TradePage[] = WEBSITE_TOPICS.map((topic) => {
  const template = STARTER_TEMPLATES.find((t) => t.id === topic.id);
  if (!template) throw new Error(`no starter for topic ${topic.id}`);
  const people = PEOPLE[topic.id];
  if (!people) throw new Error(`no audience written for topic ${topic.id}`);
  const designCount = websiteDesigns(topic.id).length;
  return {
    slug: SLUGS[topic.id] ?? topic.id,
    template,
    topic,
    people,
    title: `Website for ${people} | TapAndLaunch`,
    description: `A no-code website for ${people}: ${describeExtras(topicExtras(topic))}, in ${designCount} designs, live in minutes. Free for ${TRIAL_DAYS} days.`,
    headline: `A website for ${people}, live today`,
    includes: includesOf(topic),
    extras: topicExtras(topic),
    designCount,
  };
});

export const tradeBySlug = (slug: string): TradePage | undefined => TRADE_PAGES.find((t) => t.slug === slug);

/** The index page's title and description. */
export const TRADES_INDEX = {
  title: "Websites by trade | TapAndLaunch",
  description: `A no-code website for your trade, from ${TRADE_PAGES.length} starting points: photographers, consultants, tutors, builders and more. $${LISTED_PRICE.dollarsPerMonth} a month after ${TRIAL_DAYS} days free.`,
};
