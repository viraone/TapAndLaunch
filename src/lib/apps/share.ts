import { appOrigin } from "@/lib/stripe/checkout";

/** The address people open the app at: its own domain once verified, otherwise `{slug}.{root}`. */
export function appLiveUrl(
  app: { slug: string; custom_domain: string | null; custom_domain_status: string | null },
  rootDomain: string
): string {
  if (app.custom_domain && app.custom_domain_status === "verified") return `https://${app.custom_domain}`;
  return appOrigin(app.slug, rootDomain);
}
