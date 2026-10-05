import { appOrigin } from "@/lib/stripe/checkout";
import { getCodeAppsDomain } from "@/lib/tenant";

/**
 * The address people open the app at: its own domain once verified, otherwise `{slug}.{root}`, where an AI-written app
 * uses the separate AI-apps domain once it's set up.
 */
export function appLiveUrl(
  app: { slug: string; custom_domain: string | null; custom_domain_status: string | null; kind?: "blocks" | "code" },
  rootDomain: string
): string {
  if (app.custom_domain && app.custom_domain_status === "verified") return `https://${app.custom_domain}`;
  const code = app.kind === "code" ? getCodeAppsDomain() : null;
  return appOrigin(app.slug, code ?? rootDomain);
}
