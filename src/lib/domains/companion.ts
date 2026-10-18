import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companionDomain } from "./dns";
import type { CompanionOptions } from "./vercel";

/**
 * Whether an app may take its domain's www/root twin along (as a redirect on Vercel). It may not when another app
 * already uses that twin as its own custom domain: `brand.com` must not turn a neighbour's `www.brand.com` into a
 * redirect, nor remove it when disconnecting. Every customer domain sits on the one Vercel project, so the apps table
 * is the only register of who owns what.
 */
export async function companionOptions(appId: string, domain: string): Promise<CompanionOptions> {
  const companion = companionDomain(domain);
  if (!companion) return { companion: false };
  const admin = createAdminClient();
  const { data } = await admin.from("apps").select("id").eq("custom_domain", companion).neq("id", appId).is("deleted_at", null).limit(1).maybeSingle();
  return { companion: !data };
}
