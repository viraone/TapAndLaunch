import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBER_SESSION_COOKIE, verifyMemberSessionToken } from "@/lib/pwa/member-session";
import type { Database } from "@/types/database";

export type CurrentMember = Pick<
  Database["public"]["Tables"]["app_members"]["Row"],
  "id" | "email" | "display_name" | "tier"
>;

/**
 * The signed-in member for the published app currently being rendered, or
 * `null` if the visitor has no session cookie, an invalid/expired one, or
 * one for a member since removed from this app (re-checked against the DB
 * on every call rather than trusting the token's claims alone, so a
 * removed member's existing cookie stops working immediately rather than
 * whenever it happens to expire).
 *
 * Wrapped in `cache()` — layout, page, and any gated block all need "who's
 * viewing" for the same request.
 */
export const getCurrentMember = cache(async (appId: string): Promise<CurrentMember | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const memberId = verifyMemberSessionToken(token, appId);
  if (!memberId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("app_members")
    .select("id, email, display_name, tier")
    .eq("id", memberId)
    .eq("app_id", appId)
    .maybeSingle();

  return data ?? null;
});

/**
 * Whether `member` satisfies a block's `min_tier` gate. See the migration
 * comment on `blocks.min_tier` for the two reserved values (`null`/`''` =
 * public, `'*'` = any member) vs. an exact tier-name match.
 */
export function memberSatisfiesTier(member: CurrentMember | null, minTier: string | null): boolean {
  if (!minTier) return true;
  if (!member) return false;
  if (minTier === "*") return true;
  return member.tier === minTier;
}
