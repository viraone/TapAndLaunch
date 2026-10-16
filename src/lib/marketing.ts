import type { Metadata } from "next";
import { PLAN, TRIAL_DAYS } from "@/lib/billing/plans";
import { siteOrigin } from "@/lib/site";

/** Search-engine facing text for the home page. Kept in one place so the page, the preview card and the structured data agree. */
export const SITE_NAME = "TapAndLaunch";
export const SITE_TITLE = "TapAndLaunch: build your own app in minutes, no code";
/** One description for the page, the share card and the structured data: the category, who it is for, how big, what it does.
 * Kept to 160 characters or fewer so a search result shows all of it. */
export const SITE_DESCRIPTION = `No-code app builder for restaurants, gyms, shops and event businesses with 1-50 employees. Share by link, take payments, send push alerts. Free for ${TRIAL_DAYS} days.`;

/** The price as the public site shows it. The pricing card, the FAQ and the search-engine data all read this. */
export const LISTED_PRICE = {
  name: PLAN.name,
  dollarsPerMonth: PLAN.monthlyCents / 100,
  dollarsPerYear: PLAN.yearlyCents / 100,
  dollarsSavedPerYear: (PLAN.monthlyCents * 12 - PLAN.yearlyCents) / 100,
  headline: `${PLAN.name}: $${PLAN.monthlyCents / 100}/month`,
  pitch: "Everything included, no feature locks. Bring your own AI key.",
} as const;

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is a progressive web app (PWA)?",
    a: "A PWA is an app that opens from a link and installs to the phone's home screen straight from the browser. Your customers don't need the App Store or Google Play, and it works on both iPhone and Android.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. You build with a drag-and-drop builder and see your app on a live phone preview as you go.",
  },
  {
    q: "Can I use my own domain name?",
    a: "Yes. Every app gets its own address like yourname.tapandlaunch.com, and you can connect a domain you already own.",
  },
  {
    q: "How do I get paid?",
    a: "Connect your own Stripe account and customers can pay by card inside your app. The money goes straight to your Stripe account.",
  },
  {
    q: "Can I reach my customers after they install?",
    a: "Yes. Send a push notification or an email to all your members, or to just one group of them, from a single compose screen.",
  },
  {
    q: "How much does it cost?",
    a: `Every new account starts with a ${TRIAL_DAYS}-day free trial and no card is needed. After that the ${LISTED_PRICE.name} plan is $${LISTED_PRICE.dollarsPerMonth} a month, or $${LISTED_PRICE.dollarsPerYear} a year (you save $${LISTED_PRICE.dollarsSavedPerYear}). ${LISTED_PRICE.pitch} You can cancel any time.`,
  },
];

export const FEATURES = [
  { title: "Drag-and-drop builder", body: "Add text, photos, forms, shops and events, and arrange them on a live phone preview." },
  { title: "Installs like a real app", body: "Customers add it to their home screen from a link or QR code. No App Store, no waiting for approval." },
  { title: "Members and private content", body: "Let people sign up inside your app, and keep some pages just for members or paying tiers." },
  { title: "Push notifications and email", body: "Reach everyone, or just one group, from a single screen. Great for specials, schedule changes and news." },
  { title: "Sell and take bookings", body: "Sell products with card payments, or let people book events that stop at your capacity." },
  { title: "Your own address", body: "Publish in one click to your own web address, or connect a domain you already own." },
] as const;

export const STEPS = [
  { title: "Build it", body: "Pick a starting point and drag in what you need. You see the result on a phone as you build." },
  { title: "Publish it", body: "One click puts it on its own web address. Share the link or print the QR code." },
  { title: "Grow it", body: "Send notifications, take orders and bookings, and watch who visits." },
] as const;

export const AUDIENCES = ["Restaurants and cafés", "Gyms and studios", "Venues and events", "Shops", "Clubs and communities"] as const;

/**
 * "Who it's for", in plain sentences, so a reader that never runs JavaScript (a search engine, an assistant, a
 * sales-research tool) learns the business types, the size and the region without guessing. The size and region are
 * who the product is made for, not a lock: nothing in the product refuses a larger business or another country, and
 * where card payments work is up to Stripe (each customer connects their own Stripe account and picks its country).
 */
export const WHO_FOR = {
  heading: "Who it's for",
  types: {
    label: "Business types",
    text: "TapAndLaunch is for restaurants and cafés, gyms and studios, shops, venues and events, and clubs and communities. It also suits solo creative businesses such as photographers, designers and artists.",
  },
  size: {
    label: "Business size",
    text: "It is built for independent businesses with 1-50 employees, including solo owners. You do not need a developer.",
  },
  region: {
    label: "Where",
    text: "It is made for businesses in the United States and Canada. Card payments run on your own Stripe account, so where you can take payments follows the countries Stripe supports.",
  },
  notFor: {
    label: "Who it's not for",
    text: "It is not for businesses that need a listing in the Apple App Store or Google Play, or that have their own mobile engineering team. Your app installs from a link or QR code instead.",
  },
} as const;

/**
 * What search engines read to understand a page: who we are, and the parts that page actually shows (the product and
 * its price on the home and pricing pages, the questions on the home and FAQ pages).
 */
export function structuredData(parts: Array<"software" | "faq">) {
  const origin = siteOrigin();
  const graph: Array<Record<string, unknown>> = [{ "@type": "Organization", "@id": `${origin}/#org`, name: SITE_NAME, url: origin }];
  if (parts.includes("software")) {
    graph.push({
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: origin,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      offers: [
        { "@type": "Offer", name: `${LISTED_PRICE.name}, billed yearly`, price: LISTED_PRICE.dollarsPerYear.toFixed(2), priceCurrency: "USD" },
        { "@type": "Offer", name: `${LISTED_PRICE.name}, billed monthly`, price: LISTED_PRICE.dollarsPerMonth.toFixed(2), priceCurrency: "USD" },
      ],
      publisher: { "@id": `${origin}/#org` },
    });
  }
  if (parts.includes("faq")) {
    graph.push({ "@type": "FAQPage", mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** The data as the text of a `<script type="application/ld+json">`; `<` is escaped so nothing inside can close the tag. */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Metadata for one of the main site's own pages: its title and description, canonical address, and the share card.
 * (The home page spells its own out.) `index: false` keeps a page out of search results, for log-in and account pages.
 */
export function pageMetadata({ title, description, path, index = true }: { title: string; description: string; path: string; index?: boolean }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index ? undefined : { index: false, follow: true },
    openGraph: { type: "website", url: path, siteName: SITE_NAME, title, description, images: [{ url: "/og", width: 1200, height: 630, alt: "TapAndLaunch: your app, one tap from launch" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og"] },
  };
}
