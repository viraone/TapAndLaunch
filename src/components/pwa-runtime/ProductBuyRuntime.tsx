"use client";

import { useState, useSyncExternalStore } from "react";

export interface RuntimeProduct {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  );
}

const noopSubscribe = () => () => {};
function readPaidProduct(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("payment") === "success" ? params.get("product") : null;
}

/**
 * One product card with an inline order form — not a multi-item cart.
 * "Buy" on a product creates one order with one line item; there's no
 * cross-product basket to check out with at once. If the merchant has
 * connected Stripe, "Order" sends the shopper to Stripe's checkout page;
 * otherwise it records a purchase *request* (see migration 0018).
 */
export function ProductBuyRuntime({ product }: { product: RuntimeProduct }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  // Coming back from Stripe's checkout page: `?payment=success&product=<id>` is in the address.
  const paidJustNow = useSyncExternalStore(noopSubscribe, () => readPaidProduct() === product.id, () => false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          customerName: name,
          customerEmail: email,
          returnPath: window.location.pathname,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const { checkoutUrl } = (await res.json()) as { checkoutUrl?: string | null };
      // With Stripe connected the shopper pays on Stripe's page; otherwise it's a request.
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (paidJustNow && status === "idle") {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm">
        Payment received. Thank you! A receipt is on its way to your email.
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
        Thanks, {name || "friend"} — your order request for {product.name} was received.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      {product.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant-provided storage URL
        <img src={product.image_url} alt="" className="h-40 w-full object-cover" />
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{product.name}</h3>
          <span className="whitespace-nowrap font-semibold">{formatMoney(product.price_cents, product.currency)}</span>
        </div>
        {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Buy
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2 pt-2">
            <input
              type="text"
              required
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {status === "error" && <p className="text-sm text-destructive">Something went wrong — please try again.</p>}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {status === "submitting"
                ? "Sending…"
                : `Order ${formatMoney(product.price_cents * quantity, product.currency)}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
