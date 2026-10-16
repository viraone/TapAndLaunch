import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { activeOrgCookieHeader } from "@/lib/org";
import { addressCandidates } from "@/lib/apps/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";
import type { Database } from "@/types/database";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

// The messages are what a person reads under the form, so they say what to change in plain words.
const CreateOrgSchema = z.object({
  name: z.string().trim().min(1, "Give your organization a name.").max(120, "Use 120 characters or fewer for the name."),
  slug: z
    .string()
    .min(1, "Use at least one letter or number in the name.")
    .max(63, "That name is too long to make a web address from. Try a shorter one.")
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use only letters, numbers and hyphens in the web address."),
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
  // An organization's address is an internal label the person never sees, so two businesses with the same name must
  // both be able to sign up: when the address is taken, quietly take the next free one (`name-2`, `name-3`...). The
  // function inserts the organization and the admin membership in one transaction, so a refused try leaves nothing behind.
  let data: unknown = null;
  let error: { code?: string; message: string } | null = null;
  for (const slug of addressCandidates(parsed.data.slug)) {
    const result = await supabase.rpc("create_organization", { p_name: parsed.data.name, p_slug: slug });
    data = result.data;
    error = result.error;
    if (!error) break;
    if (error.code !== "23505") break; // only "taken" is worth another try
  }
  const org = data as OrganizationRow | null;

  if (error || !org) {
    const message = error?.code === "23505" ? "That address is already taken. Try a different name." : (error?.message ?? "Failed to create organization");
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
