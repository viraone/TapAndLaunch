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

/**
 * Whether the current user may perform editor-level actions (not just
 * read) on `appId` — `admin`/`creator`, not `client`. Used by routes whose
 * write isn't itself an RLS-gated table row (e.g. sending a notification is
 * a side effect via the service-role client, not an insert `is_org_editor`
 * would gate), so the check has to happen here instead. Both queries below
 * are still RLS-scoped — a non-member gets `null`/no rows the same as a
 * genuinely missing app, never a distinguishable "forbidden".
 */
/** Whether the current user is an `admin` of the organization that owns `appId` (the only role that may delete or restore an app). */
export async function isAppAdmin(supabase: SupabaseClient<Database>, appId: string): Promise<boolean> {
  const { data: app } = await supabase.from("apps").select("organization_id").eq("id", appId).maybeSingle();
  if (!app) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", app.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  return membership?.role === "admin";
}

export async function isAppEditor(supabase: SupabaseClient<Database>, appId: string): Promise<boolean> {
  const { data: app } = await supabase.from("apps").select("organization_id").eq("id", appId).maybeSingle();
  if (!app) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", app.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  return isEditorRole(membership?.role);
}

/** The roles that may edit an organization's apps. */
export function isEditorRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "creator";
}
