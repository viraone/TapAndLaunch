import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { canBuyDomains } from "@/lib/domains/purchase";

/**
 * The domain purchases that matter to this app's Domain tab: bought for this app, or bought on their own (no site yet)
 * by the same organization, so the tab can offer "Connect it". Newest first. Also whether this server sells domains.
 */
export async function GET(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { data: app } = await supabase.from("apps").select("organization_id").eq("id", appId).maybeSingle();
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  // Read with the user's client: members can see their organization's orders (RLS), nobody else's.
  const { data: orders, error } = await supabase
    .from("domain_orders")
    .select("*")
    .eq("organization_id", app.organization_id)
    .or(`app_id.eq.${appId},app_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ orders: orders ?? [], canBuy: canBuyDomains() });
}
