"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { BillingInterval } from "@/types/database";
import { canPayByCard } from "@/lib/stripe/checkout";
import { cartSubtotalCents, formatPrice } from "@/lib/store/cart";

export interface RuntimeProduct {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  billing_interval: BillingInterval | null;
  /** Card payments are on for this site: Stripe's page asks for name and email, so the cart skips them. */
  card_checkout?: boolean;
}

/** The shopper's cart lives in this tab only, keyed per site, so a reload or a trip to Stripe doesn't lose it. */
const CART_KEY = "tal-cart";
type Cart = Record<string, number>;

function readCart(): Cart {
  try {
    const raw = window.sessionStorage.getItem(CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Cart = {};
    for (const [id, qty] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof qty === "number" && Number.isInteger(qty) && qty > 0) out[id] = Math.min(qty, 999);
    }
    return out;
  } catch {
    return {};
  }
}

function writeCart(cart: Cart) {
  try {
    if (Object.keys(cart).length === 0) window.sessionStorage.removeItem(CART_KEY);
    else window.sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // Private mode or storage off: the cart still works for this page.
  }
}

// The cart as an external store: read once from sessionStorage, then kept in memory and written
// through on every change. Server rendering sees an empty cart; the real one appears on the client.
const EMPTY_CART: Cart = {};
let cartCache: Cart | null = null;
const cartListeners = new Set<() => void>();
function getCart(): Cart {
  if (!cartCache) cartCache = readCart();
  return cartCache;
}
function setCart(next: Cart) {
  cartCache = next;
  writeCart(next);
  for (const l of cartListeners) l();
}
function subscribeCart(listener: () => void) {
  cartListeners.add(listener);
  return () => {
    cartListeners.delete(listener);
  };
}

const noopSubscribe = () => () => {};
type Payment = { state: "success" | "cancelled" | null; orderId: string | null };
const noPayment: Payment = { state: null, orderId: null };
// Cached per query string: a snapshot has to be the same object on every read, or React keeps re-rendering.
let paymentFor: { search: string; value: Payment } | null = null;
function readPayment(): Payment {
  const search = window.location.search;
  if (paymentFor?.search !== search) {
    const params = new URLSearchParams(search);
    const payment = params.get("payment");
    paymentFor = { search, value: { state: payment === "success" || payment === "cancelled" ? payment : null, orderId: params.get("order") } };
  }
  return paymentFor.value;
}

/**
 * The store: every product with "Add to cart", and one cart that checks out at once. With Stripe
 * connected the shopper pays on Stripe's page (which also handles shipping, tax and promo codes);
 * otherwise the cart becomes a purchase *request* the merchant follows up on (see migration 0018).
 */
export function StoreRuntime({ products }: { products: RuntimeProduct[] }) {
  const cart = useSyncExternalStore(subscribeCart, getCart, () => EMPTY_CART);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const payment = useSyncExternalStore(noopSubscribe, readPayment, () => noPayment);

  // Back from Stripe: the cart was bought, and the server is asked to confirm the payment now rather
  // than waiting for the webhook.
  useEffect(() => {
    if (payment.state !== "success") return;
    setCart({});
    if (!payment.orderId) return;
    void fetch("/orders/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: payment.orderId }) });
  }, [payment.state, payment.orderId]);

  function update(id: string, quantity: number) {
    const next = { ...getCart() };
    if (quantity <= 0) delete next[id];
    else next[id] = Math.min(quantity, 999);
    setCart(next);
  }

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart)
    .map(([id, quantity]) => ({ product: byId.get(id), quantity }))
    .filter((l): l is { product: RuntimeProduct; quantity: number } => !!l.product);
  const currency = lines[0]?.product.currency ?? products[0]?.currency ?? "usd";
  const subtotal = cartSubtotalCents(lines.map((l) => ({ unitPriceCents: l.product.price_cents, quantity: l.quantity })));
  const cards = products.length > 0 && products.every((p) => p.card_checkout);
  const cardCheckout = cards && canPayByCard(subtotal);
  const recurring = lines.some((l) => l.product.billing_interval);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          ...(cardCheckout ? {} : { customerName: name, customerEmail: email }),
          returnPath: window.location.pathname,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { checkoutUrl?: string | null; error?: string };
      if (!res.ok) {
        setError(body.error ?? null);
        setStatus("error");
        return;
      }
      // With Stripe connected the shopper pays on Stripe's page; otherwise it's a request.
      if (body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
        return;
      }
      setCart({});
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      {payment.state === "success" && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm">
          Payment received. Thank you! A receipt is on its way to your email.
        </div>
      )}
      {payment.state === "cancelled" && lines.length > 0 && (
        <p className="rounded-md border p-3 text-center text-sm text-muted-foreground">Checkout cancelled. Your cart is still here.</p>
      )}
      {status === "submitted" && (
        <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
          Thanks, {name || "friend"} — your order request was received.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3 @lg:gap-5 @5xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} quantity={cart[product.id] ?? 0} onChange={(q) => update(product.id, q)} />
        ))}
      </div>

      {lines.length > 0 && status !== "submitted" && (
        <form onSubmit={handleSubmit} className="rounded-md border p-4" aria-label="Cart">
          <h3 className="mb-3 font-medium">Your cart</h3>
          <ul className="divide-y">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(product.price_cents, product.currency, product.billing_interval)} each</p>
                </div>
                <Stepper quantity={quantity} onChange={(q) => update(product.id, q)} label={product.name} />
                <span className="w-20 text-right font-medium">{formatPrice(product.price_cents * quantity, product.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">{formatPrice(subtotal, currency)}</span>
          </div>
          {cardCheckout && (
            <p className="mt-1 text-xs text-muted-foreground">
              {recurring ? "Recurring items renew automatically. " : ""}Shipping and tax, if any, are worked out at checkout.
            </p>
          )}

          {!cardCheckout && (
            <div className="mt-3 space-y-2">
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
            </div>
          )}
          {status === "error" && <p className="mt-2 text-sm text-destructive">{error ?? "Something went wrong — please try again."}</p>}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="mt-3 w-full rounded-[var(--button-radius,0.375rem)] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {status === "submitting"
              ? cardCheckout
                ? "Opening checkout…"
                : "Sending…"
              : cardCheckout
                ? `Checkout · ${formatPrice(subtotal, currency)}`
                : `Send order request · ${formatPrice(subtotal, currency)}`}
          </button>
        </form>
      )}
    </div>
  );
}

function ProductCard({ product, quantity, onChange }: { product: RuntimeProduct; quantity: number; onChange: (q: number) => void }) {
  return (
    <div className="overflow-hidden rounded-md border">
      {product.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant-provided storage URL
        <img src={product.image_url} alt="" className="h-40 w-full object-cover" />
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{product.name}</h3>
          <span className="whitespace-nowrap font-semibold">{formatPrice(product.price_cents, product.currency, product.billing_interval)}</span>
        </div>
        {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
        {quantity === 0 ? (
          <button
            type="button"
            onClick={() => onChange(1)}
            className="w-full rounded-[var(--button-radius,0.375rem)] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Add to cart
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">In cart</span>
            <Stepper quantity={quantity} onChange={onChange} label={product.name} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ quantity, onChange, label }: { quantity: number; onChange: (q: number) => void; label: string }) {
  const button = "h-7 w-7 rounded-md border text-sm leading-none";
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={button} aria-label={`Fewer ${label}`} onClick={() => onChange(quantity - 1)}>
        −
      </button>
      <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button type="button" className={button} aria-label={`More ${label}`} onClick={() => onChange(quantity + 1)}>
        +
      </button>
    </div>
  );
}
