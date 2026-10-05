import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applySubscription } from "@/lib/billing/stripe";

/**
 * Stripe tells us here when someone subscribes, changes plan, fails a payment or cancels. This is a *separate*
 * endpoint from `/api/stripe/webhook` (that one hears about shoppers paying our customers, on their connected
 * accounts); this one listens to events on our own Stripe account, with its own signing secret in
 * STRIPE_BILLING_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  if (!isStripeConfigured() || !secret) return Response.json({ error: "Billing webhooks are not configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const organizationId = sub.metadata?.organization_id ?? (await orgForCustomer(admin, typeof sub.customer === "string" ? sub.customer : sub.customer.id));
      if (!organizationId) break;
      const { error } = await applySubscription(admin, organizationId, sub);
      if (error) return Response.json({ error }, { status: 500 });
      break;
    }
    case "checkout.session.completed": {
      // The subscription events carry the details; this just makes sure the customer is linked right away.
      const session = event.data.object;
      const organizationId = session.metadata?.organization_id ?? session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (session.mode === "subscription" && organizationId && customerId) {
        await admin.from("org_billing").update({ stripe_customer_id: customerId }).eq("organization_id", organizationId);
      }
      break;
    }
    default:
      break;
  }

  // 200 for events we don't act on too, so Stripe doesn't keep retrying them.
  return Response.json({ received: true });
}

async function orgForCustomer(admin: ReturnType<typeof createAdminClient>, customerId: string): Promise<string | null> {
  const { data } = await admin.from("org_billing").select("organization_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.organization_id ?? null;
}
