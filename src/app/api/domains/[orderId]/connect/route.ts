import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { connectDomainOrder } from "@/lib/domains/purchase";

const Schema = z.object({ app_id: z.string().uuid() });

/** Connects a domain the organization bought here to one of its sites (Dashboard > Domains, or a site's Domain tab). */
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a site" }, { status: 400 });

  const supabase = await createClient();
  // RLS: only members of the organization that bought the domain can see the order at all.
  const { data: order } = await supabase.from("domain_orders").select("id").eq("id", orderId).maybeSingle();
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await isAppEditor(supabase, parsed.data.app_id))) return Response.json({ error: "Not authorized" }, { status: 403 });

  const result = await connectDomainOrder(supabase, createAdminClient(), orderId, parsed.data.app_id);
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}
