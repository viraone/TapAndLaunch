"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { priceLabel } from "@/lib/domains/buy";
import type { Database, DomainOrderStatus } from "@/types/database";

type OrderRow = Database["public"]["Tables"]["domain_orders"]["Row"];
interface AppOption {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function DomainsList({ orders, apps, canEdit, domainReturn }: { orders: OrderRow[]; apps: AppOption[]; canEdit: boolean; domainReturn: DomainOrderStatus | null }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Back from Stripe: say how it went, and drop the `?domain=…` so a reload doesn't repeat it.
  useEffect(() => {
    if (!domainReturn) return;
    window.history.replaceState(null, "", window.location.pathname);
    switch (domainReturn) {
      case "registered":
        toast.success("Your domain is registered. Connect it to a site below.");
        break;
      case "paid":
        toast.success("Payment received. Your domain is being set up; give it a minute, then reload.");
        break;
      case "failed":
        toast.error("Your payment went through but the domain could not be registered. You will be refunded; email support if you don't hear from us.", { duration: 15000 });
        break;
      case "cancelled":
        toast("Checkout closed. Nothing was charged.");
        break;
      default:
        toast("Payment not confirmed yet. If you did pay, reload in a minute.");
    }
  }, [domainReturn]);

  async function connect(order: OrderRow) {
    const appId = choice[order.id];
    if (!appId) return;
    setBusy(order.id);
    try {
      const res = await fetch(`/api/domains/${order.id}/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: appId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't connect the domain");
        return;
      }
      toast.success(body.app?.custom_domain_status === "verified" ? "Domain connected" : "Domain connected. It starts working in a few minutes, once its DNS has spread.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-300 px-8 py-16 text-center">
        <p className="text-lg font-medium tracking-tight">No domains yet</p>
        <p className="mx-auto mt-2 max-w-md text-neutral-600">
          Your sites work at their tapandlaunch.com address already. A domain of your own is a search away.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
      {orders.map((o) => {
        const connectedTo = apps.find((a) => a.custom_domain === o.domain) ?? null;
        const free = apps.filter((a) => !a.custom_domain);
        return (
          <li key={o.id} className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="truncate text-xl font-medium tracking-tight">{o.domain}</p>
                <StatusBadge status={o.status} />
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                {o.status === "registered" && <>Bought {longDate(o.created_at)}{o.expires_at ? `, renews ${longDate(o.expires_at)}` : ""} at {priceLabel(o.price_cents, o.renew_cents, o.currency)}.</>}
                {o.status === "paid" && <>Payment received; registering now. Reload in a minute.</>}
                {o.status === "pending" && <>Checkout not finished. Nothing has been charged.</>}
                {o.status === "failed" && <>We took your payment but the registration failed. You will get a full refund.{o.error ? ` Reason: ${o.error}` : ""}</>}
              </p>
              {o.status === "registered" && o.error && !connectedTo && <p className="mt-1 text-sm text-amber-700">{o.error}</p>}
            </div>
            {o.status === "registered" && (
              <div className="flex flex-wrap items-center gap-3">
                {connectedTo ? (
                  <p className="text-sm text-neutral-700">
                    Connected to{" "}
                    <Link href={`/dashboard/apps/${connectedTo.id}/builder`} className="font-medium text-neutral-950 underline-offset-4 hover:underline">
                      {connectedTo.name}
                    </Link>
                  </p>
                ) : canEdit && free.length > 0 ? (
                  <>
                    <label htmlFor={`site-${o.id}`} className="sr-only">
                      Site to connect {o.domain} to
                    </label>
                    <select
                      id={`site-${o.id}`}
                      value={choice[o.id] ?? ""}
                      onChange={(e) => setChoice((c) => ({ ...c, [o.id]: e.target.value }))}
                      className="h-11 rounded-full border border-neutral-300 bg-white px-4 text-sm text-neutral-950 outline-none focus:border-neutral-950"
                    >
                      <option value="">Choose a site…</option>
                      {free.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!choice[o.id] || busy === o.id}
                      onClick={() => void connect(o)}
                      className="inline-flex min-h-11 items-center rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {busy === o.id ? "Connecting…" : "Connect"}
                    </button>
                  </>
                ) : canEdit ? (
                  <p className="text-sm text-neutral-600">
                    {apps.length === 0 ? (
                      <>
                        No site yet.{" "}
                        <Link href="/dashboard/apps/new" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
                          Build one
                        </Link>{" "}
                        and connect this domain to it.
                      </>
                    ) : (
                      "Every site already has a domain. Remove one in its App settings to connect this instead."
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-600">Not connected to a site yet.</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ status }: { status: DomainOrderStatus }) {
  const look: Record<DomainOrderStatus, { text: string; cls: string }> = {
    registered: { text: "Yours", cls: "bg-emerald-50 text-emerald-800" },
    paid: { text: "Setting up", cls: "bg-indigo-50 text-indigo-800" },
    pending: { text: "Not paid", cls: "bg-neutral-100 text-neutral-700" },
    failed: { text: "Failed", cls: "bg-red-50 text-red-700" },
    cancelled: { text: "Cancelled", cls: "bg-neutral-100 text-neutral-700" },
  };
  const { text, cls } = look[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}
