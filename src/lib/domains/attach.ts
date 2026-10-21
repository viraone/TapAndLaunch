import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { validateCustomDomain } from "./validate";
import { addDomain, removeDomain, verifyDomain } from "./vercel";
import { pointDomainAtUs, type PointResult } from "./namesilo";
import { companionOptions } from "./companion";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];

export type AttachResult =
  | { app: AppRow; dns: PointResult["status"]; dnsError?: string; companionError?: string }
  | { error: string };

/**
 * Attaches a custom domain to an app: adds it to the Vercel project (with its www/root twin as a redirect), writes the
 * DNS itself when the domain is in the platform's NameSilo account, then records the result on the app row. Used by
 * the Domain tab's "Add domain" (with the signed-in user's client, so RLS applies to the write) and by a domain bought
 * here, right after it is registered (with the service-role client; the purchase was already checked). The caller
 * must have checked authorization before calling: the Vercel call is a side effect RLS can't gate.
 */
export async function attachDomain(db: SupabaseClient<Database>, appId: string, input: string): Promise<AttachResult> {
  const domain = input.trim().toLowerCase();
  const validationError = validateCustomDomain(domain);
  if (validationError) return { error: validationError };

  // A root domain brings its `www.` twin along (and the other way round) as a redirect, unless another app owns it.
  const twin = await companionOptions(appId, domain);
  let result = await addDomain(domain, twin);
  if (result.error) return { error: result.error };
  const companionError = result.companionError;

  // A domain in the platform's own NameSilo account gets its DNS written here and now, then one fresh check with
  // Vercel so a quick registrar makes it "Connected" straight away. Any other domain keeps the add-it-yourself flow.
  let dns: PointResult = { status: "not_here" };
  if (!result.verified) {
    dns = await pointDomainAtUs(domain, result.verification);
    if (dns.status === "set") {
      const again = await verifyDomain(domain, twin);
      if (!again.error) result = again;
    }
  }

  const { data: app, error } = await db
    .from("apps")
    .update({
      custom_domain: domain,
      custom_domain_status: result.verified ? "verified" : "pending",
      custom_domain_verification: result.verification,
      custom_domain_dns: dns.status === "set" ? "namesilo" : null,
    })
    .eq("id", appId)
    .select("*")
    .single();

  if (error) {
    // The domain is now attached on Vercel's side but the DB write that was supposed to record it failed (not
    // authorized, app not found, etc.): detach it again rather than leaving an orphaned Vercel domain no app knows about.
    await removeDomain(domain, twin).catch(() => {});
    return { error: error.code === "23505" ? "That domain is already in use by another app" : error.message };
  }

  return { app, dns: dns.status, dnsError: dns.status === "failed" ? dns.error : undefined, companionError };
}
