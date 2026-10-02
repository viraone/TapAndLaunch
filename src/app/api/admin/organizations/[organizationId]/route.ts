import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";

const Schema = z.object({ maps_enabled: z.boolean() });

/** Platform admins only: switch Google Maps features on or off for an organization. */
export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isPlatformAdmin(supabase))) return Response.json({ error: "Not allowed" }, { status: 403 });

  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("organizations")
    .update({ maps_enabled: parsed.data.maps_enabled })
    .eq("id", organizationId)
    .select("id, maps_enabled")
    .maybeSingle();
  if (error || !data) return Response.json({ error: error?.message ?? "Organization not found" }, { status: 400 });
  return Response.json({ organization: data });
}
