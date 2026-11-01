import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusSelect } from "./OrderStatusSelect";
import { LocalTime } from "@/components/dashboard/LocalTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ORDERS_PAGE_SIZE,
  ORDER_STATUS_FILTERS,
  orderSearchFilter,
  pageRange,
  parseOrderListParams,
} from "@/lib/orders/query";

type Params = Promise<{ appId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// `id` is a uuid, so it cannot be searched with ILIKE; customers are found by
// name or email. The order id is shown on the detail page.
const SEARCH_COLUMNS = ["customer_name", "customer_email"];

const STATUS_LABELS: Record<(typeof ORDER_STATUS_FILTERS)[number], string> = {
  all: "All",
  pending: "Pending",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  );
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { appId } = await params;
  const { q, status, page } = parseOrderListParams(await searchParams);
  const { from, to } = pageRange(page);

  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .eq("app_id", appId);

  if (status !== "all") query = query.eq("status", status);

  const search = orderSearchFilter(q, SEARCH_COLUMNS);
  if (search) query = query.or(search);

  const { data: orders, count: pageQueryCount } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  // A page past the end makes PostgREST fail the range and return no count,
  // so count again to show "No orders on this page" instead of "No orders yet".
  let count = pageQueryCount;
  if (count === null && page > 1) {
    let countQuery = supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("app_id", appId);
    if (status !== "all") countQuery = countQuery.eq("status", status);
    if (search) countQuery = countQuery.or(search);
    count = (await countQuery).count;
  }

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

  const ordersOnPage = orders ?? [];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const listHref = `/dashboard/apps/${appId}/orders`;
  const filtersActive = q !== "" || status !== "all";

  function pageHref(target: number): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status !== "all") next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const query = next.toString();
    return query ? `${listHref}?${query}` : listHref;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — orders</h1>
        <Link href={`/dashboard/apps/${appId}/products`} className="text-sm underline">
          Manage products
        </Link>
      </div>

      <form action={listHref} method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 text-xs text-muted-foreground">
          Search
          <Input
            name="q"
            defaultValue={q}
            placeholder="Customer name or email"
            maxLength={80}
            className="mt-1"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={status}
            className="mt-1 block h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            {ORDER_STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Search</Button>
        {filtersActive && (
          <Link href={listHref} className="pb-1.5 text-sm underline">
            Clear
          </Link>
        )}
      </form>

      {ordersOnPage.length === 0 ? (
        total > 0 ? (
          <p className="text-sm text-muted-foreground">
            No orders on this page.{" "}
            <Link href={pageHref(pageCount)} className="underline">
              Go to page {pageCount}
            </Link>
          </p>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p>{filtersActive ? "No orders match your search." : "No orders yet."}</p>
            {filtersActive && (
              <p className="mt-1">
                <Link href={listHref} className="underline">
                  Clear filters
                </Link>
              </p>
            )}
          </div>
        )
      ) : (
        <>
          <div className="space-y-3">
            {ordersOnPage.map((order) => (
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
                      {item.quantity}× {item.product_name} ({formatMoney(item.unit_price_cents, order.currency)}
                      {item.billing_interval ? `/${item.billing_interval}` : ""} each)
                    </li>
                  ))}
                  {order.shipping_cents > 0 && <li>Shipping {formatMoney(order.shipping_cents, order.currency)}</li>}
                  {order.tax_cents > 0 && <li>Tax {formatMoney(order.tax_cents, order.currency)}</li>}
                  {order.discount_cents > 0 && <li>Discount −{formatMoney(order.discount_cents, order.currency)}</li>}
                </ul>
                {order.shipping_address && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ship to: {[order.shipping_name, order.shipping_address.line1, order.shipping_address.line2, order.shipping_address.city, order.shipping_address.state, order.shipping_address.postal_code, order.shipping_address.country].filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <p>
                    <LocalTime iso={order.created_at} />
                    {order.payment_method === "stripe" ? " · Card payment" : " · Order request"}
                    {order.stripe_subscription_id ? " · Subscription" : ""}
                  </p>
                  <Link href={`${listHref}/${order.id}`} className="shrink-0 underline">
                    View order
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <p>
                Showing {from + 1}-{from + ordersOnPage.length} of {total}
              </p>
              <div className="flex items-center gap-3">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="underline">
                    Previous
                  </Link>
                )}
                {page < pageCount && (
                  <Link href={pageHref(page + 1)} className="underline">
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
