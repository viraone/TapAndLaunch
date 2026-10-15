import type { BlockType } from "@/types/database";
import type { StarterEvent, StarterProduct } from "@/lib/apps/templates";

/**
 * "What do you want to do with your site?": the second question of the picker, after the topic. Each goal is one
 * ready-made section the new site gets if it does not already have one of that kind (see `buildStarter`), with
 * sample content where a section would otherwise be empty on first open. Squarespace asks the same question and
 * only reorders its templates with the answers; here the answers change the site, which is the honest version.
 */
export type GoalId = "gallery" | "bookings" | "shop" | "prices" | "hours" | "faq" | "map" | "video" | "audio";

export interface WebsiteGoal {
  id: GoalId;
  label: string;
  /** One line under the label: what the site gets. */
  blurb: string;
  /** The section the goal adds. */
  block: BlockType;
  config: Record<string, unknown>;
  /** The page it goes on: Home, or Contact for the things people look up before getting in touch. */
  page: "home" | "contact";
  /** Sample rows created with the app so a calendar or shop is not empty on first open. */
  events?: StarterEvent[];
  products?: StarterProduct[];
}

const SAMPLE_EVENT = "This is a sample. Edit it or delete it under Manage, Events.";
const SAMPLE_PRODUCT = "(Sample product: edit it under Manage, Products.)";

export const WEBSITE_GOALS: WebsiteGoal[] = [
  { id: "gallery", label: "Show your work", blurb: "A photo gallery on the home page.", block: "gallery", page: "home", config: { title: "Recent work", images: [] } },
  {
    id: "bookings",
    label: "Take bookings",
    blurb: "A calendar people can book from, with sample appointments to edit.",
    block: "event_calendar",
    page: "contact",
    config: { title: "Book a time" },
    events: [
      { title: "Free first chat", description: `Twenty minutes to talk through what you need. ${SAMPLE_EVENT}`, dayOffset: 1, time: "10:00", minutes: 20, capacity: 1 },
      { title: "Standard session", description: `One hour, in person or online. ${SAMPLE_EVENT}`, dayOffset: 2, time: "14:00", minutes: 60, capacity: 1 },
      { title: "Standard session", description: `One hour, in person or online. ${SAMPLE_EVENT}`, dayOffset: 4, time: "11:00", minutes: 60, capacity: 1 },
    ],
  },
  {
    id: "shop",
    label: "Sell products",
    blurb: "A shop with sample products; card payments go through your own Stripe account.",
    block: "product_list",
    page: "home",
    config: { title: "Shop" },
    products: [
      { name: "Gift card", description: `Any amount, sent by email. ${SAMPLE_PRODUCT}`, priceCents: 5000 },
      { name: "Signature item", description: `Your best seller goes here. ${SAMPLE_PRODUCT}`, priceCents: 2500 },
      { name: "Bundle of three", description: `Three of something, a little cheaper together. ${SAMPLE_PRODUCT}`, priceCents: 6500 },
    ],
  },
  {
    id: "prices",
    label: "List your prices",
    blurb: "A services-and-prices list with sample items to edit.",
    block: "price_list",
    page: "home",
    config: {
      title: "Services & prices",
      subtitle: "",
      sections: [
        {
          name: "Services",
          items: [
            { name: "Consultation", description: "30 minutes", price: "$50" },
            { name: "Standard session", description: "60 minutes", price: "$90", badge: "Popular" },
            { name: "Package of five", description: "Five sessions, booked together", price: "$400" },
          ],
        },
      ],
    },
  },
  {
    id: "hours",
    label: "Show opening hours",
    blurb: "Your hours and area on the Contact page; you add the address.",
    block: "hours",
    page: "contact",
    config: {
      title: "Hours & area",
      rows: [
        { label: "Mon to Fri", value: "9am to 5pm" },
        { label: "Saturday", value: "10am to 2pm" },
        { label: "Sunday", value: "Closed" },
      ],
      address: "",
      phone: "",
    },
  },
  {
    id: "faq",
    label: "Answer common questions",
    blurb: "A questions-and-answers section, three to start.",
    block: "faq",
    page: "home",
    config: {
      title: "Common questions",
      items: [
        { question: "How do I get started?", answer: "Send a message through the contact page and I'll reply within a day or two." },
        { question: "Where are you based?", answer: "Add your town or area here, and whether you travel or work remotely." },
        { question: "What does it cost?", answer: "Add a line about your prices here, or point people to the price list." },
      ],
    },
  },
  { id: "map", label: "Show a map", blurb: "A map on the Contact page; you type the address in.", block: "map", page: "contact", config: { title: "Find us", address: "" } },
  { id: "video", label: "Add a video", blurb: "A video on the home page; paste a YouTube link later.", block: "video", page: "home", config: { provider: "youtube", url: "" } },
  { id: "audio", label: "Add music or audio", blurb: "An audio player on the home page, for a track or a sample.", block: "audio", page: "home", config: { src: "", title: "", note: "" } },
];

export const GOAL_IDS: string[] = WEBSITE_GOALS.map((g) => g.id);

export function isGoalId(id: string): id is GoalId {
  return GOAL_IDS.includes(id);
}
