import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationTarget } from "@/types/database";

export interface PushRecipient {
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface EmailRecipient {
  memberId: string;
  email: string;
}

export interface SmsRecipient {
  memberId: string;
  phone: string;
}

/**
 * Tier-targeting is resolved as two queries (member ids for the tier, then
 * subscriptions/contacts for those ids) rather than a single embedded
 * `push_subscriptions.select("...,app_members(tier)")` — see the
 * `Relationships: []` note in `types/database.ts` on why an embedded join's
 * shape isn't reliably inferred here.
 */
async function memberIdsForTarget(appId: string, target: NotificationTarget): Promise<string[] | "all"> {
  if (target.type === "all") return "all";

  const admin = createAdminClient();
  const { data } = await admin
    .from("app_members")
    .select("id")
    .eq("app_id", appId)
    .eq("tier", target.tier);

  return (data ?? []).map((m) => m.id);
}

export async function resolvePushRecipients(
  appId: string,
  target: NotificationTarget
): Promise<PushRecipient[]> {
  const admin = createAdminClient();
  const memberIds = await memberIdsForTarget(appId, target);

  let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("app_id", appId);
  // Tier-targeted push only reaches subscriptions tied to a qualifying
  // member — a subscription with no member at all never matches a tier.
  if (memberIds !== "all") query = query.in("member_id", memberIds);

  const { data } = await query;
  return (data ?? []).map((s) => ({ subscriptionId: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));
}

export async function resolveEmailRecipients(
  appId: string,
  target: NotificationTarget
): Promise<EmailRecipient[]> {
  const admin = createAdminClient();
  // Members who clicked Unsubscribe in an earlier email are left out.
  let query = admin.from("app_members").select("id, email").eq("app_id", appId).is("email_unsubscribed_at", null);
  if (target.type === "tier") query = query.eq("tier", target.tier);

  const { data } = await query;
  return (data ?? []).map((m) => ({ memberId: m.id, email: m.email }));
}

export async function resolveSmsRecipients(appId: string, target: NotificationTarget): Promise<SmsRecipient[]> {
  const admin = createAdminClient();
  let query = admin.from("app_members").select("id, phone").eq("app_id", appId).not("phone", "is", null);
  if (target.type === "tier") query = query.eq("tier", target.tier);

  const { data } = await query;
  return (data ?? [])
    .filter((m): m is { id: string; phone: string } => !!m.phone)
    .map((m) => ({ memberId: m.id, phone: m.phone }));
}
