export const SHIPPING_ROW_PREFIX = "Shipping:";

type OrderLine = {
  product_id: string | null;
  product_name: string;
  unit_price_cents: number;
  quantity: number;
};

/** Subscription checkouts store their shipping as an order_items row named
 * "Shipping: <rate>" (see subscriptionShippingLine in src/lib/store/cart.ts)
 * instead of in orders.shipping_cents. */
export function isShippingRow(line: Pick<OrderLine, "product_id" | "product_name">): boolean {
  return line.product_id === null && line.product_name.startsWith(SHIPPING_ROW_PREFIX);
}

/** Splits order_items into the things the customer bought and the shipping rows,
 * and totals each so the order page can show items, shipping and the total consistently. */
export function splitOrderLines<T extends OrderLine>(
  lines: T[]
): { products: T[]; shippingRows: T[]; productsCents: number; shippingRowsCents: number } {
  const products: T[] = [];
  const shippingRows: T[] = [];
  for (const line of lines) (isShippingRow(line) ? shippingRows : products).push(line);

  const sum = (rows: T[]) => rows.reduce((total, row) => total + row.unit_price_cents * row.quantity, 0);
  return { products, shippingRows, productsCents: sum(products), shippingRowsCents: sum(shippingRows) };
}
