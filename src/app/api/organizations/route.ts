import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { activeOrgCookieHeader } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";
import type { Database } from "@/types/database";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lowercase letters, numbers, and hyphens only"),
});

/**
 * Creates an organization and makes the calling user its admin, via the
 * `create_organization` Postgres function (0012) — one transaction for
 * both inserts, and it sidesteps the RLS gotcha that broke the original
 * two-insert version: an INSERT ... RETURNING on `organizations` has to
 * pass the SELECT policy too, which the creator can't at that instant
 * because they aren't a member yet.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = CreateOrgSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // No `.single()`: the function returns one composite row (not `setof`),
  // which PostgREST already serializes as a single object.
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  const org = data as OrganizationRow | null;

  if (error || !org) {
    const message = error?.code === "23505" ? "That URL slug is already taken" : (error?.message ?? "Failed to create organization");
    return Response.json({ error: message }, { status: 400 });
  }

  // Google Maps features are off for new customers; a platform admin's own
  // organizations get them (their apps are the ones that use them).
  if (await isPlatformAdmin(supabase)) {
    await createAdminClient().from("organizations").update({ maps_enabled: true }).eq("id", org.id);
    org.maps_enabled = true;
  }

  // A newly created org becomes the active one immediately — otherwise it
  // would only appear in the switcher, unselected, until the user picked it
  // by hand.
  const response = Response.json({ organization: org }, { status: 201 });
  response.headers.append("Set-Cookie", activeOrgCookieHeader(org.id));
  return response;
}
