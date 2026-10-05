import type { Metadata } from "next";
import { PLAN, TRIAL_DAYS } from "@/lib/billing/plans";

/** Search-engine facing text for the home page. Kept in one place so the page, the preview card and the structured data agree. */
export const SITE_NAME = "TapAndLaunch";
export const SITE_TITLE = "TapAndLaunch: build your own app in minutes, no code";
export const SITE_DESCRIPTION =
  "Build an app for your restaurant, gym, shop or event, no code needed. Share it by link or QR code, take payments and send push notifications. Free for 30 days.";

const money = (cents: number) => `$${Math.round(cents / 100)}`;

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
    a: `Every new account starts with a ${TRIAL_DAYS}-day free trial and no card is needed. After that the ${PLAN.name} plan is ${money(PLAN.yearlyCents / 12)} a month billed yearly (${money(PLAN.yearlyCents)}), or ${money(PLAN.monthlyCents)} a month if you prefer to pay monthly. You can cancel any time.`,
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
