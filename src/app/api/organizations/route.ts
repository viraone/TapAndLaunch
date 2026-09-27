import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lowercase letters, numbers, and hyphens only"),
});

/**
 * Creates an organization and makes the calling user its admin. Two inserts,
 * not a transaction: Supabase's PostgREST-backed client has no client-side
 * transaction API, so if the membership insert fails after the org insert
 * succeeds, the caller is left with an orgless org. Acceptable for Phase 1
 * (single onboarding action, low volume); a Postgres function callable via
 * `rpc()` would make this atomic if it becomes a real failure mode.
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

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name, slug: parsed.data.slug })
    .select("*")
    .single();

  if (orgError) {
    const message = orgError.code === "23505" ? "That URL slug is already taken" : orgError.message;
    return Response.json({ error: message }, { status: 400 });
  }

  const { error: membershipError } = await supabase
    .from("memberships")
    .insert({ organization_id: org.id, user_id: user.id, role: "admin" });

  if (membershipError) {
    return Response.json({ error: membershipError.message }, { status: 400 });
  }

  return Response.json({ organization: org }, { status: 201 });
}
