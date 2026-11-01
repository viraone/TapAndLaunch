"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LocalTime } from "@/components/dashboard/LocalTime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/orders/money";
import { REFUND_CURRENCIES, dollarsToCents, refundableCents } from "@/lib/orders/refunds";
import type { Database, OrderStatus, PaymentMethod } from "@/types/database";

type RefundRow = Database["public"]["Tables"]["order_refunds"]["Row"];

const MAX_REASON = 200;
const NETWORK_ERROR = "We could not reach the server. Check Stripe before trying again.";

export function RefundCard({
  appId,
  orderId,
  currency,
  totalCents,
  refundedCents,
  status,
  paymentMethod,
  canRefund,
  refunds,
}: {
  appId: string;
  orderId: string;
  currency: string;
  totalCents: number;
  refundedCents: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  canRefund: boolean;
  refunds: RefundRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = refundableCents({
    total_cents: totalCents,
    refunded_cents: refundedCents,
    status,
  });
  const notice = refundNotice({ paymentMethod, status, available, currency, canRefund });

  const partialCents = dollarsToCents(amountText);
  let amountError: string | null = null;
  if (mode === "partial") {
    if (amountText.trim() === "") amountError = "Enter an amount.";
    else if (partialCents === null) amountError = "Enter an amount like 12.50.";
    else if (partialCents > available) {
      amountError = `You can refund at most ${formatMoney(available, currency)}.`;
    }
  }
  const amountCents = mode === "full" ? available : partialCents;
  const canReview = amountCents !== null && amountCents > 0 && amountError === null;

  const ledgerCents = refunds
    .filter((refund) => refund.status === "succeeded" || refund.status === "pending")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const otherRefundCents = refundedCents - ledgerCents;

  function openDialog() {
    setStep(1);
    setMode("full");
    setAmountText("");
    setReason("");
    setError(null);
    setIdempotencyKey(crypto.randomUUID());
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    if (sending) return;
    setOpen(next);
  }

  function review() {
    if (!canReview) return;
    setError(null);
    setStep(2);
  }

  async function submit() {
    if (amountCents === null || amountCents <= 0 || sending) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/apps/${appId}/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: amountCents,
          reason: reason.trim(),
          idempotency_key: idempotencyKey,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? "Something went wrong sending the refund.");
        if (body?.code !== "processing") setIdempotencyKey(crypto.randomUUID());
        return;
      }

      toast.success(`Refunded ${formatMoney(amountCents, currency)}`);
      setIdempotencyKey(crypto.randomUUID());
      setOpen(false);
      router.refresh();
    } catch {
      // The request never got an answer, so keep the key: sending it again with the same key is safe.
      setError(NETWORK_ERROR);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Paid</dt>
            <dd>{formatMoney(totalCents, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Refunded so far</dt>
            <dd>{formatMoney(refundedCents, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Available to refund</dt>
            <dd>{formatMoney(available, currency)}</dd>
          </div>
        </dl>

        {notice ? (
          <p className="text-sm text-muted-foreground">{notice}</p>
        ) : (
          <>
            <Button onClick={openDialog}>Refund…</Button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogContent className="sm:max-w-md">
                {step === 1 ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Refund</DialogTitle>
                      <DialogDescription>
                        Choose how much of this order should go back to the customer.
                      </DialogDescription>
                    </DialogHeader>

                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">Amount</legend>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`refund-mode-${orderId}`}
                          checked={mode === "full"}
                          onChange={() => setMode("full")}
                        />
                        Full remaining ({formatMoney(available, currency)})
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`refund-mode-${orderId}`}
                          checked={mode === "partial"}
                          onChange={() => setMode("partial")}
                        />
                        Part of it
                      </label>
                    </fieldset>

                    {mode === "partial" && (
                      <div className="space-y-1">
                        <label
                          htmlFor={`refund-amount-${orderId}`}
                          className="text-xs text-muted-foreground"
                        >
                          Amount to refund
                        </label>
                        <Input
                          id={`refund-amount-${orderId}`}
                          value={amountText}
                          onChange={(event) => setAmountText(event.target.value)}
                          inputMode="decimal"
                          placeholder="12.50"
                          aria-invalid={amountError !== null || undefined}
                        />
                        {amountError && <p className="text-sm text-destructive">{amountError}</p>}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label
                        htmlFor={`refund-reason-${orderId}`}
                        className="text-xs text-muted-foreground"
                      >
                        Reason (optional)
                      </label>
                      <Textarea
                        id={`refund-reason-${orderId}`}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={MAX_REASON}
                        placeholder="Why is this going back?"
                      />
                      <p className="text-right text-xs text-muted-foreground">
                        {reason.length}/{MAX_REASON}
                      </p>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={review} disabled={!canReview}>
                        Review refund
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Review refund</DialogTitle>
                      <DialogDescription>
                        Send {formatMoney(amountCents ?? 0, currency)} back to the customer&rsquo;s card? This
                        cannot be undone.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      {reason.trim() !== "" && <p>Reason: {reason.trim()}</p>}
                      <p>
                        {amountCents !== null && available - amountCents > 0
                          ? `${formatMoney(available - amountCents, currency)} will remain available to refund.`
                          : "Nothing will remain available to refund."}
                      </p>
                    </div>

                    {error && (
                      <p role="alert" className="text-sm text-destructive">
                        {error}
                      </p>
                    )}

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setError(null);
                          setStep(1);
                        }}
                        disabled={sending}
                      >
                        Back
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={submit}
                        disabled={sending || amountCents === null}
                      >
                        {sending ? "Sending…" : `Refund ${formatMoney(amountCents ?? 0, currency)}`}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </>
        )}

        {(refunds.length > 0 || otherRefundCents > 0) && (
          <div className="space-y-3 border-t pt-3">
            {refunds.length > 0 && (
              <ul className="space-y-2">
                {refunds.map((refund) => (
                  <li key={refund.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{formatMoney(refund.amount_cents, currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          {refund.created_by_email ?? "Unknown author"} ·{" "}
                          <LocalTime iso={refund.created_at} />
                        </p>
                        {refund.reason && <p className="mt-1 text-muted-foreground">{refund.reason}</p>}
                      </div>
                      {refund.status === "pending" && (
                        <p className="shrink-0 text-right text-xs text-muted-foreground">
                          Processing. Check Stripe if this stays here
                        </p>
                      )}
                      {refund.status === "failed" && (
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <p>Failed</p>
                          {refund.error_message && <p>{refund.error_message}</p>}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {otherRefundCents > 0 && (
              <p className="text-sm text-muted-foreground">
                Other refunds made in Stripe: {formatMoney(otherRefundCents, currency)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function refundNotice({
  paymentMethod,
  status,
  available,
  currency,
  canRefund,
}: {
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  available: number;
  currency: string;
  canRefund: boolean;
}): string | null {
  if (paymentMethod !== "stripe") {
    return "This was a purchase request, so there is no card payment to refund.";
  }
  if (status === "refunded") return "Fully refunded.";
  if (status !== "paid" && status !== "fulfilled") {
    return status === "cancelled"
      ? "This order was cancelled, so there is nothing to refund."
      : "This order has not been paid yet, so there is nothing to refund.";
  }
  if (available === 0) return "Fully refunded.";
  if (!(REFUND_CURRENCIES as readonly string[]).includes(currency.toLowerCase())) {
    return "Refund this order in your Stripe dashboard.";
  }
  if (!canRefund) return "Only editors can send refunds.";
  return null;
}
