import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { OrderStatusSelect } from "../OrderStatusSelect";
import { OrderNotes } from "./OrderNotes";
import { OrderTags } from "./OrderTags";
import { RefundCard } from "./RefundCard";
import { splitOrderLines } from "@/lib/orders/lines";
import { formatMoney } from "@/lib/orders/money";
import { partlyRefunded } from "@/lib/orders/refunds";
import { LocalTime } from "@/components/dashboard/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderStatus } from "@/types/database";

type Params = Promise<{ appId: string; orderId: string }>;

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function OrderDetailPage({ params }: { params: Params }) {
  const { appId, orderId } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("app_id", appId)
    .maybeSingle();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  const { data: notes } = await supabase
    .from("order_notes")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: refunds } = await supabase
    .from("order_refunds")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const canRefund = await isAppEditor(supabase, appId);

  const {
    products: lineItems,
    productsCents: subtotalCents,
    shippingRowsCents,
  } = splitOrderLines(items ?? []);
  const shippingCents = order.shipping_cents + shippingRowsCents;

  const shipTo = [
    order.shipping_name,
    order.shipping_address?.line1,
    order.shipping_address?.line2,
    order.shipping_address?.city,
    order.shipping_address?.state,
    order.shipping_address?.postal_code,
    order.shipping_address?.country,
  ].filter((line): line is string => Boolean(line));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/dashboard/apps/${appId}/orders`} className="underline">
              Back to orders
            </Link>
            <Link
              href={`/dashboard/apps/${appId}/orders/${order.id}/packing-slip`}
              className="underline"
            >
              Print packing slip
            </Link>
          </div>
          <h1 className="mt-2 text-xl font-semibold">Order {order.id}</h1>
          <p className="text-sm text-muted-foreground">
            Placed <LocalTime iso={order.created_at} />
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{STATUS_LABELS[order.status]}</Badge>
          {partlyRefunded(order) && <Badge variant="outline">Partly refunded</Badge>}
          <OrderStatusSelect
            appId={appId}
            orderId={order.id}
            status={order.status}
            paymentMethod={order.payment_method}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {lineItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4">
                  <div>
                    <p>
                      {item.quantity}× {item.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(item.unit_price_cents, order.currency)}
                      {item.billing_interval ? `/${item.billing_interval}` : ""} each
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatMoney(item.unit_price_cents * item.quantity, order.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <OrderNotes appId={appId} orderId={order.id} notes={notes ?? []} />
      <OrderTags appId={appId} orderId={order.id} tags={order.tags} />

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Items subtotal</dt>
              <dd>{formatMoney(subtotalCents, order.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd>{formatMoney(shippingCents, order.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd>{formatMoney(order.tax_cents, order.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd>
                {order.discount_cents > 0 ? "−" : ""}
                {formatMoney(order.discount_cents, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <dt>Total</dt>
              <dd>{formatMoney(order.total_cents, order.currency)}</dd>
            </div>
            {order.refunded_cents > 0 && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Refunded</dt>
                  <dd>−{formatMoney(order.refunded_cents, order.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Net</dt>
                  <dd>{formatMoney(order.total_cents - order.refunded_cents, order.currency)}</dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{order.customer_name}</p>
            <p className="text-muted-foreground">{order.customer_email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ship to</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {shipTo.length === 0 ? (
              <p className="text-muted-foreground">No shipping address provided.</p>
            ) : (
              <address className="not-italic">
                {shipTo.map((line, index) => (
                  <span key={index} className="block">
                    {line}
                  </span>
                ))}
              </address>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{order.payment_method === "stripe" ? "Card payment" : "Purchase request"}</p>
          {order.paid_at && (
            <p className="text-muted-foreground">
              Paid <LocalTime iso={order.paid_at} />
            </p>
          )}
          {order.stripe_payment_intent_id && (
            <p className="break-all font-mono text-xs text-muted-foreground">
              Payment intent: {order.stripe_payment_intent_id}
            </p>
          )}
          {order.stripe_subscription_id && (
            <p className="break-all font-mono text-xs text-muted-foreground">
              Subscription: {order.stripe_subscription_id}
            </p>
          )}
        </CardContent>
      </Card>

      <RefundCard
        appId={appId}
        orderId={order.id}
        currency={order.currency}
        totalCents={order.total_cents}
        refundedCents={order.refunded_cents}
        status={order.status}
        paymentMethod={order.payment_method}
        canRefund={canRefund}
        refunds={refunds ?? []}
      />
    </main>
  );
}
