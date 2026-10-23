"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Gives one organization a free account: cancels its Stripe subscription (if any) and marks it free for good. */
export function FreeAccountButton({ organizationId, name, hasSubscription, alreadyFree = false }: { organizationId: string; name: string; hasSubscription: boolean; alreadyFree?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function makeFree() {
    const warning = alreadyFree
      ? `Cancel ${name}'s Stripe subscription right now? Nothing is refunded, and their account stays free.`
      : hasSubscription
        ? `Make ${name} free? Their Stripe subscription is cancelled right now (nothing is refunded) and they will never be charged for a plan.`
        : `Make ${name} free? They will never be charged for a plan.`;
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/free`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't make that account free. Nothing was changed.");
        return;
      }
      toast.success(body.cancelledSubscription ? `${name} is free, and their Stripe subscription is cancelled.` : alreadyFree ? `${name} had no live subscription left; nothing to cancel.` : `${name} is free.`);
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void makeFree()}
      className="inline-flex h-9 items-center rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
    >
      {busy ? "Working…" : alreadyFree ? "Cancel Stripe plan" : "Make free"}
    </button>
  );
}
