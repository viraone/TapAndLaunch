import { actionFor } from "@/lib/stripe/events";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe tells us here when a shopper has paid, a checkout expired, a charge was refunded, or a
 * merchant finished setting up their account. Register this URL in Stripe as a webhook that
 * listens to events on **Connected accounts**, and put its signing secret in STRIPE_WEBHOOK_SECRET.
 * Every request is checked against that secret, so nobody else can mark an order paid.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isStripeConfigured() || !secret) {
    return Response.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const action = actionFor(event);
  const admin = createAdminClient();

  switch (action.kind) {
    case "order_paid": {
      // Keyed on both ids and on `pending`, so a repeated event can't change anything twice.
      const { error } = await admin
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: action.paymentIntentId })
        .eq("id", action.orderId)
        .eq("stripe_checkout_session_id", action.sessionId)
        .eq("status", "pending");
      if (error) return Response.json({ error: error.message }, { status: 500 });
      break;
    }
    case "order_cancelled": {
      const { error } = await admin
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", action.orderId)
        .eq("stripe_checkout_session_id", action.sessionId)
        .eq("status", "pending");
      if (error) return Response.json({ error: error.message }, { status: 500 });
      break;
    }
    case "order_refunded": {
      const { error } = await admin
        .from("orders")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent_id", action.paymentIntentId)
        .in("status", ["paid", "fulfilled"]);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      break;
    }
    case "account_updated": {
      const { error } = await admin
        .from("stripe_accounts")
        .update({ charges_enabled: action.chargesEnabled, details_submitted: action.detailsSubmitted })
        .eq("stripe_account_id", action.accountId);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      break;
    }
    case "ignore":
      break;
  }

  // 200 for events we don't act on too, so Stripe doesn't keep retrying them.
  return Response.json({ received: true });
}
