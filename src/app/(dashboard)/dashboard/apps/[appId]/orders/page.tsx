import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusSelect } from "./OrderStatusSelect";

type Params = Promise<{ appId: string }>;

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  );
}

export default async function OrdersPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(100);

  // Two queries, not an embedded `orders.select("...,order_items(...)")` —
  // see the `Relationships: []` note in `types/database.ts`.
  const { data: items } = orders && orders.length > 0
    ? await supabase
        .from("order_items")
        .select("*")
        .in(
          "order_id",
          orders.map((o) => o.id)
        )
    : { data: [] };

  const itemsByOrderId = new Map<string, typeof items>();
  for (const item of items ?? []) {
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrderId.set(item.order_id, list);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — orders</h1>
        <Link href={`/dashboard/apps/${appId}/products`} className="text-sm underline">
          Manage products
        </Link>
      </div>

      {!orders || orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-md border p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium">{order.customer_name || "Awaiting payment details"}</p>
                  {order.customer_email && <p className="text-xs text-muted-foreground">{order.customer_email}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatMoney(order.total_cents, order.currency)}</span>
                  <OrderStatusSelect appId={appId} orderId={order.id} status={order.status} paymentMethod={order.payment_method} />
                </div>
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {(itemsByOrderId.get(order.id) ?? []).map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.product_name} ({formatMoney(item.unit_price_cents, order.currency)} each)
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleString()}
                {order.payment_method === "stripe" ? " · Card payment" : " · Order request"}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
