import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { makeOrganizationFree } from "@/lib/billing/stripe";

/**
 * Platform admins only: give an organization a free account. Its Stripe subscription, if it has one, is cancelled
 * with the live key this server already holds (nothing is charged or refunded), and its billing row becomes
 * `complimentary`, which Stripe's later events no longer change.
 */
export async function POST(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isPlatformAdmin(supabase))) return Response.json({ error: "Not allowed" }, { status: 403 });

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("id").eq("id", organizationId).maybeSingle();
  if (!org) return Response.json({ error: "Organization not found" }, { status: 404 });

  try {
    const result = await makeOrganizationFree(admin, organizationId);
    if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
    return Response.json({ ok: true, cancelledSubscription: result.cancelledSubscription });
  } catch (error) {
    console.error("make organization free failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't make that account free. Nothing was changed." }, { status: 502 });
  }
}
