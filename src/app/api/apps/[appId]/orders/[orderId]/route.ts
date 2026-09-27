import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UpdateOrderSchema = z.object({
  status: z.enum(["pending", "fulfilled", "cancelled"]),
});

/** Updates an order's status. RLS (`org editors can update their apps'
 * orders`, 0006) is the actual authorization check. */
export async function PATCH(request: Request, context: { params: Promise<{ appId: string; orderId: string }> }) {
  const { orderId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = UpdateOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ order });
}
