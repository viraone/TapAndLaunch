import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BrandingSchema = z.object({
  logo_url: z.string().optional(),
  primary_color: z.string().optional(),
  footer_text: z.string().optional(),
});

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  branding: BrandingSchema.optional(),
});

/**
 * Updates an org's display name and/or white-label branding. RLS
 * (`admins can update their organization`) restricts this to the `admin`
 * role — a `creator` can build apps but not re-brand the agency, matching
 * the role split the schema was designed around.
 */
export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = UpdateOrgSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", organizationId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ organization });
}
