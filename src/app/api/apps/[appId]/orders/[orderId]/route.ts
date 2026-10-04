import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UpdateOrderSchema = z.object({
  // `paid` and `refunded` are set only by the Stripe webhook, never by hand.
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

  const { data: current } = await supabase
    .from("orders")
    .select("status, payment_method")
    .eq("id", orderId)
    .maybeSingle();
  if (!current) return Response.json({ error: "Order not found" }, { status: 404 });

  // A card payment is settled by Stripe, not by hand: a paid or refunded order can only be marked
  // fulfilled (a refund is done in Stripe), and one still waiting for payment can only be cancelled.
  const next = parsed.data.status;
  if ((current.status === "paid" || current.status === "refunded") && next !== "fulfilled") {
    return Response.json({ error: "Refund or cancel paid orders from your Stripe dashboard." }, { status: 400 });
  }
  if (current.payment_method === "stripe" && current.status === "pending" && next === "fulfilled") {
    return Response.json({ error: "This order hasn't been paid yet." }, { status: 400 });
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
