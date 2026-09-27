import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/pwa/get-current-member";
import { recordAnalyticsEvent } from "@/lib/pwa/analytics";

const OrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
});

/**
 * Creates one order with one line item — see `ProductBuyRuntime`'s comment
 * on why this is "buy this product now," not a multi-item cart. No payment
 * is processed; this records a purchase *request* (`orders.status` starts
 * `'pending'`) for the merchant to follow up on manually until Phase 7
 * wires up real payment.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = OrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("id, name, price_cents, currency, is_active")
    .eq("id", parsed.data.productId)
    .eq("app_id", published.app.id)
    .maybeSingle();

  if (!product || !product.is_active) {
    return Response.json({ error: "Product not available" }, { status: 400 });
  }

  const member = await getCurrentMember(published.app.id);
  const totalCents = product.price_cents * parsed.data.quantity;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      app_id: published.app.id,
      member_id: member?.id ?? null,
      customer_name: parsed.data.customerName,
      customer_email: parsed.data.customerEmail,
      total_cents: totalCents,
      currency: product.currency,
    })
    .select("id")
    .single();

  if (orderError) {
    return Response.json({ error: orderError.message }, { status: 400 });
  }

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    product_name: product.name,
    unit_price_cents: product.price_cents,
    quantity: parsed.data.quantity,
  });

  if (itemError) {
    return Response.json({ error: itemError.message }, { status: 400 });
  }

  await recordAnalyticsEvent({
    appId: published.app.id,
    memberId: member?.id,
    eventType: "order_placed",
    metadata: { productId: product.id, quantity: parsed.data.quantity, totalCents },
  });

  return Response.json({ orderId: order.id }, { status: 201 });
}
