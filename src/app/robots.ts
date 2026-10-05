import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

/** For the main site only. The dashboard, API and account pages aren't for search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api/", "/auth/", "/onboarding", "/reset-password", "/forgot-password"],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
