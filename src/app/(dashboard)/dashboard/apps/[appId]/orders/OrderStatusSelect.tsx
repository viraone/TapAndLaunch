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
import type { OrderStatus } from "@/types/database";

export function OrderStatusSelect({ appId, orderId, status }: { appId: string; orderId: string; status: OrderStatus }) {
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
    <Select value={value} onValueChange={(v) => handleChange(v as OrderStatus)} disabled={saving}>
      <SelectTrigger className="h-7 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="fulfilled">Fulfilled</SelectItem>
        <SelectItem value="cancelled">Cancelled</SelectItem>
      </SelectContent>
    </Select>
  );
}
