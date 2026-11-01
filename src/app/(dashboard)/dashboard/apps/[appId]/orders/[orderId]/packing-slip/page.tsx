import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { splitOrderLines } from "@/lib/orders/lines";
import { LocalTime } from "@/components/dashboard/LocalTime";
import { PrintButton } from "./PrintButton";

type Params = Promise<{ appId: string; orderId: string }>;

export default async function PackingSlipPage({ params }: { params: Params }) {
  const { appId, orderId } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("app_id", appId)
    .maybeSingle();
  if (!order) notFound();

  const { data: app } = await supabase.from("apps").select("name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", order.id);
  const { products } = splitOrderLines(items ?? []);

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
    <main className="mx-auto w-full max-w-3xl flex-1 bg-white p-6 text-black print:max-w-none print:bg-white print:p-0 print:text-black">
      <div className="mb-8 flex items-center justify-between gap-4 print:hidden">
        <Link
          href={`/dashboard/apps/${appId}/orders/${order.id}`}
          className="text-sm underline print:hidden"
        >
          Back to order
        </Link>
        <PrintButton />
      </div>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-medium">{app.name}</p>
          <h1 className="text-2xl font-semibold">Packing slip</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-semibold leading-none">{order.id.slice(0, 8)}</p>
          <p className="mt-1 break-all font-mono text-[10px] text-neutral-500">{order.id}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-neutral-500">Order date</p>
          <p className="text-sm">
            <LocalTime iso={order.created_at} dateOnly />
          </p>
        </div>
      </div>

      <div className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Ship to</p>
        {shipTo.length === 0 ? (
          <p className="text-sm">No shipping address provided.</p>
        ) : (
          <address className="not-italic text-sm">
            {shipTo.map((line, index) => (
              <span key={index} className="block">
                {line}
              </span>
            ))}
          </address>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-sm">No items.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="w-16 py-2 pr-4 font-semibold">Qty</th>
              <th className="py-2 font-semibold">Item</th>
            </tr>
          </thead>
          <tbody>
            {products.map((item) => (
              <tr key={item.id} className="border-b border-neutral-300">
                <td className="py-2 pr-4 align-top">{item.quantity}</td>
                <td className="py-2">{item.product_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-10 text-sm">Thank you for your order</p>
    </main>
  );
}
