import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { isStripeConfigured } from "@/lib/stripe/server";
import { createRefund, type RefundResult } from "@/lib/orders/createRefund";
import { supabaseRefundStore, stripeRefundDeps } from "@/lib/orders/refundAdapters";

const RefundSchema = z.object({
  amount_cents: z
    .number()
    .int("Refund amount must be a whole number of cents")
    .min(1, "Refund amount must be at least 1 cent")
    .max(99_999_999, "Refund amount is too large"),
  reason: z
    .string()
    .trim()
    .max(200, "Reason must be 200 characters or fewer")
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value)),
  idempotency_key: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/, "Idempotency key must be 8-64 letters, numbers, dashes or underscores"),
});

const STATUS_FOR_CODE: Record<Extract<RefundResult, { ok: false }>["code"], number> = {
  not_found: 404,
  invalid_amount: 400,
  exceeds: 400,
  not_refundable: 409,
  conflict: 409,
  processing: 409,
  no_payment: 422,
  no_account: 422,
  stripe_error: 502,
};

const UNEXPECTED = "Something went wrong sending the refund. Check Stripe before trying again.";

/** Sends part or all of a card-paid order back to the shopper through the seller's Stripe account. */
export async function POST(
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

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  if (!isStripeConfigured()) {
    return Response.json({ error: "Payments are not set up on this server." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const parsed = RefundSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const result = await createRefund(
      { store: supabaseRefundStore(admin), ...stripeRefundDeps(admin) },
      {
        orderId,
        appId,
        amountCents: parsed.data.amount_cents,
        reason: parsed.data.reason,
        idempotencyKey: parsed.data.idempotency_key,
        userId: user.id,
        userEmail: user.email ?? null,
      }
    );

    if (!result.ok) {
      return Response.json(
        { error: result.message, code: result.code },
        { status: STATUS_FOR_CODE[result.code] }
      );
    }

    return Response.json({
      refund: result.refund,
      refundedCents: result.refundedCents,
      fullyRefunded: result.fullyRefunded,
      replay: result.replay,
    });
  } catch {
    return Response.json({ error: UNEXPECTED }, { status: 500 });
  }
}
