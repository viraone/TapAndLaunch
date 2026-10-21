import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { canBuyDomains } from "@/lib/domains/purchase";

/** The app's domain purchases, newest first, and whether this server sells domains at all. For the Domain tab. */
export async function GET(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "Not authorized" }, { status: 403 });

  // Read with the user's client: members can see their organization's orders (RLS), nobody else's.
  const { data: orders, error } = await supabase.from("domain_orders").select("*").eq("app_id", appId).order("created_at", { ascending: false }).limit(10);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ orders: orders ?? [], canBuy: canBuyDomains() });
}
