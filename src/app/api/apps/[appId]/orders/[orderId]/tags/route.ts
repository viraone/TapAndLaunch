import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeTags } from "@/lib/orders/tags";

const UpdateTagsSchema = z.object({
  tags: z.array(z.string()),
});

/** Replaces an order's tags. RLS (`org editors can update their apps'
 * orders`, 0006) is the actual authorization check. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ appId: string; orderId: string }> }
) {
  const { appId, orderId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = UpdateTagsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .update({ tags: normalizeTags(parsed.data.tags) })
    .eq("id", orderId)
    .eq("app_id", appId)
    .select("tags")
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (!order) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  return Response.json({ tags: order.tags });
}
