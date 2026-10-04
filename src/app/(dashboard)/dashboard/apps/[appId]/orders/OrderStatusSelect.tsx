"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderStatus, PaymentMethod } from "@/types/database";

const LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** What the merchant may switch an order to. Card payments are settled by Stripe, so paid and
 * refunded orders can only be fulfilled, and an unpaid card order can only be cancelled. */
function choicesFor(status: OrderStatus, method: PaymentMethod): OrderStatus[] {
  if (status === "paid" || status === "refunded") return status === "paid" ? ["paid", "fulfilled"] : ["refunded"];
  if (method === "stripe" && status === "pending") return ["pending", "cancelled"];
  return ["pending", "fulfilled", "cancelled"];
}

export function OrderStatusSelect({
  appId,
  orderId,
  status,
  paymentMethod = "request",
}: {
  appId: string;
  orderId: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
}) {
  const choices = choicesFor(status, paymentMethod);
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: OrderStatus) {
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Failed to update order");
        setValue(status);
        return;
      }
      toast.success("Order updated");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select
      value={value}
      items={LABELS}
      onValueChange={(v) => handleChange(v as OrderStatus)}
      disabled={saving}
    >
      <SelectTrigger className="h-7 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((c) => (
          <SelectItem key={c} value={c} disabled={c === "paid" || c === "refunded"}>
            {c === "pending" && paymentMethod === "stripe" ? "Awaiting payment" : LABELS[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
