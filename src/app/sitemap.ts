import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
import { TRADE_PAGES } from "@/lib/marketing/trades";

/** The pages of the main site that belong in search results. Customers' apps are not listed here. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/faq`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/for`, changeFrequency: "monthly", priority: 0.8 },
    ...TRADE_PAGES.map((t) => ({ url: `${origin}/for/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${origin}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/support`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/refunds`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
