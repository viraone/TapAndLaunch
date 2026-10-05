import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeAccountRow } from "@/lib/stripe/accounts";
import { customerOf } from "@/lib/stripe/events";
import { markOrderPaid } from "@/lib/stripe/orders";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

const Schema = z.object({ orderId: z.string().uuid() });

/**
 * Called when a shopper lands back from Stripe's checkout page. Asks Stripe directly whether the
 * session was paid and, if so, marks the order paid — the same result the webhook produces, without
 * waiting for it. The answer comes from Stripe, never from the caller, so passing someone else's
 * order id changes nothing.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });
  if (!isStripeConfigured()) return Response.json({ status: "unknown" });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, payment_method, stripe_checkout_session_id")
    .eq("id", parsed.data.orderId)
    .eq("app_id", published.app.id)
    .maybeSingle();
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "pending" || order.payment_method !== "stripe" || !order.stripe_checkout_session_id) {
    return Response.json({ status: order.status });
  }

  const account = await getStripeAccountRow(admin, published.app.organization_id);
  if (!account) return Response.json({ status: order.status });

  try {
    const session = await getStripe().checkout.sessions.retrieve(order.stripe_checkout_session_id, undefined, {
      stripeAccount: account.stripe_account_id,
    });
    if (session.payment_status !== "paid") return Response.json({ status: "pending" });
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
    const { error } = await markOrderPaid(admin, { orderId: order.id, sessionId: session.id, paymentIntentId, customer: customerOf(session) });
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ status: "paid" });
  } catch (error) {
    console.error("stripe confirm failed:", error instanceof Error ? error.message : error);
    return Response.json({ status: "pending" });
  }
}
