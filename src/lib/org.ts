import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Role } from "@/types/database";

export const ACTIVE_ORG_COOKIE = "active_org_id";

/** `Set-Cookie` header value for switching the active org, shared by the
 * two routes that can change it (create, and explicit switch). */
export function activeOrgCookieHeader(organizationId: string): string {
  return `${ACTIVE_ORG_COOKIE}=${organizationId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
}

export interface MembershipSummary {
  organization_id: string;
  role: Role;
  name: string;
  slug: string;
}

/**
 * All organizations the current user belongs to, with their role in each.
 * RLS (`memberships` select policy) already scopes this to the caller —
 * there is no explicit `user_id` filter here.
 */
export async function getMemberships(
  supabase: SupabaseClient<Database>
): Promise<MembershipSummary[]> {
  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role, organizations(name, slug)");

  // See the `Relationships: []` note in `types/database.ts` — with no
  // relationship metadata for the generic to resolve, an embedded select
  // like `organizations(name, slug)` collapses the whole row to `never`
  // rather than just leaving that one field loosely typed. Cast the array
  // once here instead of fighting the query builder's generics.
  const rows = (data ?? []) as unknown as Array<{
    organization_id: string;
    role: Role;
    organizations: { name: string; slug: string } | null;
  }>;

  return rows.map((row) => ({
    organization_id: row.organization_id,
    role: row.role,
    name: row.organizations?.name ?? "",
    slug: row.organizations?.slug ?? "",
  }));
}

/**
 * The org the dashboard should show right now: the `active_org_id` cookie
 * if it's set *and* still one of the user's memberships, otherwise the
 * first membership, otherwise `null` (no org — caller should redirect to
 * onboarding). Falling back rather than trusting the cookie outright means
 * a stale cookie from a since-removed membership can't leak which org used
 * to be active.
 */
export async function getActiveOrganizationId(
  supabase: SupabaseClient<Database>,
  memberships: MembershipSummary[]
): Promise<string | null> {
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  if (cookieOrgId && memberships.some((m) => m.organization_id === cookieOrgId)) {
    return cookieOrgId;
  }
  return memberships[0].organization_id;
}
