export const ORDER_STATUS_FILTERS = [
  "all",
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
] as const;

export const ORDERS_PAGE_SIZE = 25;

const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 80;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseOrderListParams(sp: Record<string, string | string[] | undefined>): {
  q: string;
  status: (typeof ORDER_STATUS_FILTERS)[number];
  page: number;
} {
  const q = (first(sp.q) ?? "").trim().slice(0, MAX_SEARCH_LENGTH);

  const rawStatus = first(sp.status);
  const status =
    rawStatus && (ORDER_STATUS_FILTERS as readonly string[]).includes(rawStatus)
      ? (rawStatus as (typeof ORDER_STATUS_FILTERS)[number])
      : "all";

  const rawPage = first(sp.page);
  const parsedPage = rawPage === undefined ? Number.NaN : Number(rawPage);
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 ? Math.min(parsedPage, MAX_PAGE) : 1;

  return { q, status, page };
}

/** Escapes a search term for an ILIKE pattern and removes the characters that
 * PostgREST reads as `.or()` syntax, so the term cannot break the filter. */
export function escapeIlike(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/[(),"]/g, "");
}

export function orderSearchFilter(q: string, columns: string[]): string | null {
  const term = q.trim();
  if (term === "" || columns.length === 0) return null;

  const pattern = `%${escapeIlike(term)}%`;
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}

export function pageRange(page: number, size: number = ORDERS_PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}
