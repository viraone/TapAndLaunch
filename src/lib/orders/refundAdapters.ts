import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getStripeAccountRow } from "@/lib/stripe/accounts";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import type { RefundDeps, RefundOrder, RefundRow, RefundStore } from "./createRefund";

type Admin = SupabaseClient<Database>;

/** The refund ledger and the order reservation, backed by Supabase. Written only with the
 * service-role client: the migration gives the browser read access and nothing else. */
export function supabaseRefundStore(admin: Admin): RefundStore {
  return {
    async loadOrder(orderId, appId): Promise<RefundOrder | null> {
      const { data, error } = await admin
        .from("orders")
        .select(
          "id, app_id, status, payment_method, currency, total_cents, refunded_cents, stripe_payment_intent_id, stripe_checkout_session_id, stripe_subscription_id"
        )
        .eq("id", orderId)
        .eq("app_id", appId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async organizationIdForApp(appId) {
      const { data, error } = await admin
        .from("apps")
        .select("organization_id")
        .eq("id", appId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.organization_id ?? null;
    },

    async findRefund(orderId, idempotencyKey): Promise<RefundRow | null> {
      const { data, error } = await admin
        .from("order_refunds")
        .select("id, order_id, idempotency_key, stripe_refund_id, amount_cents, reason, status, created_at")
        .eq("order_id", orderId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async insertPending(row): Promise<RefundRow | null> {
      const { data, error } = await admin
        .from("order_refunds")
        .insert({
          order_id: row.orderId,
          idempotency_key: row.idempotencyKey,
          amount_cents: row.amountCents,
          reason: row.reason,
          status: "pending",
          created_by: row.userId,
          created_by_email: row.userEmail,
        })
        .select("id, order_id, idempotency_key, stripe_refund_id, amount_cents, reason, status, created_at")
        .single();
      if (error) {
        // 23505 = a concurrent click already used this (order, idempotency key).
        if (error.code === "23505") return null;
        throw new Error(error.message);
      }
      return data;
    },

    async reserve(orderId, expectedRefundedCents, amountCents) {
      const { data, error } = await admin
        .from("orders")
        .update({ refunded_cents: expectedRefundedCents + amountCents })
        .eq("id", orderId)
        .eq("refunded_cents", expectedRefundedCents)
        .select("id");
      if (error) throw new Error(error.message);
      return data?.length === 1;
    },

    async release(orderId, amountCents) {
      // PostgREST cannot subtract inside an update, so read, subtract, then write only if the
      // value is still the one we read. A second try covers a refund landing in between.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data, error } = await admin
          .from("orders")
          .select("refunded_cents")
          .eq("id", orderId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return;

        const reflected = Math.max(0, data.refunded_cents - amountCents);
        const { data: changed, error: writeError } = await admin
          .from("orders")
          .update({ refunded_cents: reflected })
          .eq("id", orderId)
          .eq("refunded_cents", data.refunded_cents)
          .select("id");
        if (writeError) throw new Error(writeError.message);
        if (changed?.length === 1) return;
      }
      throw new Error("Could not release the refund reservation");
    },

    async setPaymentIntent(orderId, paymentIntentId) {
      const { error } = await admin
        .from("orders")
        .update({ stripe_payment_intent_id: paymentIntentId })
        .eq("id", orderId)
        .is("stripe_payment_intent_id", null);
      if (error) throw new Error(error.message);
    },

    async markSucceeded(refundRowId, stripeRefundId) {
      const { error } = await admin
        .from("order_refunds")
        .update({ status: "succeeded", stripe_refund_id: stripeRefundId, error_message: null })
        .eq("id", refundRowId);
      if (error) throw new Error(error.message);
    },

    async markFailed(refundRowId, message) {
      const { error } = await admin
        .from("order_refunds")
        .update({ status: "failed", error_message: message })
        .eq("id", refundRowId);
      if (error) throw new Error(error.message);
    },

    async markOrderRefunded(orderId) {
      // Read the two totals first: PostgREST cannot compare one column with another in a filter.
      const { data, error } = await admin
        .from("orders")
        .select("refunded_cents, total_cents")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || data.refunded_cents < data.total_cents) return;

      const { error: writeError } = await admin
        .from("orders")
        .update({ status: "refunded" })
        .eq("id", orderId)
        .in("status", ["paid", "fulfilled"])
        .gte("refunded_cents", data.total_cents);
      if (writeError) throw new Error(writeError.message);
    },

    async addNote(orderId, body, userId, userEmail) {
      const { error } = await admin
        .from("order_notes")
        .insert({ order_id: orderId, body, author_id: userId, author_email: userEmail });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * The Stripe half of a refund. Store checkouts are direct charges on the seller's connected
 * account, so every call names that account; no application-fee or transfer reversal is passed,
 * because this platform keeps no share of a store sale.
 */
export function stripeRefundDeps(
  admin: Admin
): Pick<RefundDeps, "stripeAccountId" | "resolvePaymentIntent" | "createStripeRefund"> {
  return {
    async stripeAccountId(organizationId) {
      if (!isStripeConfigured()) return null;
      const account = await getStripeAccountRow(admin, organizationId);
      return account?.charges_enabled ? account.stripe_account_id : null;
    },

    async resolvePaymentIntent(order, stripeAccountId) {
      if (!order.stripe_checkout_session_id) return null;
      try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(
          order.stripe_checkout_session_id,
          { expand: ["payment_intent", "invoice"] },
          { stripeAccount: stripeAccountId }
        );
        const direct = idOf(session.payment_intent);
        if (direct) return direct;

        const invoiceId = idOf(session.invoice);
        if (!invoiceId) return null;
        const invoice = await stripe.invoices.retrieve(
          invoiceId,
          { expand: ["payments"] },
          { stripeAccount: stripeAccountId }
        );
        return paymentIntentIdFromInvoice(invoice);
      } catch {
        return null;
      }
    },

    async createStripeRefund(args) {
      const refund = await getStripe().refunds.create(
        {
          payment_intent: args.paymentIntentId,
          amount: args.amountCents,
          metadata: args.metadata,
        },
        { stripeAccount: args.stripeAccountId, idempotencyKey: args.idempotencyKey }
      );
      return { id: refund.id };
    },
  };
}

/**
 * The payment intent behind an invoice's payments. This Stripe API version no longer has
 * `invoice.payment_intent`; each entry in `payments.data` names its own payment, and only the
 * `payment_intent` kind is refundable by us.
 */
export function paymentIntentIdFromInvoice(
  invoice: {
    payments?: {
      data?: Array<{
        payment?: {
          type?: string;
          payment_intent?: string | { id: string } | null;
          charge?: string | { id: string } | null;
          payment_record?: string | { id: string } | null;
        } | null;
      }>;
    } | null;
  } | null
  | undefined
): string | null {
  const payments = invoice?.payments?.data;
  if (!Array.isArray(payments)) return null;

  for (const entry of payments) {
    if (entry?.payment?.type !== "payment_intent") continue;
    const id = idOf(entry.payment.payment_intent);
    if (id) return id;
  }
  return null;
}

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);
