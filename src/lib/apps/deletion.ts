/** How long a deleted app can be restored before it is erased for good. Must match the 30 days in migration 0027. */
export const APP_RESTORE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left to restore a deleted app, rounded up; 0 once the window has passed. */
export function restoreDaysLeft(deletedAt: string, now: Date): number {
  const left = new Date(deletedAt).getTime() + APP_RESTORE_DAYS * DAY_MS - now.getTime();
  return left <= 0 ? 0 : Math.ceil(left / DAY_MS);
}

/** The typed confirmation must be the app's name, exactly (extra spaces at either end are forgiven). */
export function confirmationMatches(typed: unknown, appName: string): boolean {
  return typeof typed === "string" && typed.trim() === appName.trim() && appName.trim().length > 0;
}

/** What the confirmation box lists as lost, from the counts we have; zero counts are left out. */
export interface DeletionCounts {
  members: number;
  orders: number;
  submissions: number;
  bookings: number;
  subscribers: number;
  products: number;
}

export function describeLosses(c: DeletionCounts): string[] {
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
  const lines: string[] = [];
  if (c.members) lines.push(plural(c.members, "member", "members"));
  if (c.orders) lines.push(plural(c.orders, "order", "orders"));
  if (c.submissions) lines.push(plural(c.submissions, "form submission", "form submissions"));
  if (c.bookings) lines.push(plural(c.bookings, "booking", "bookings"));
  if (c.products) lines.push(plural(c.products, "product", "products"));
  if (c.subscribers) lines.push(plural(c.subscribers, "notification subscriber", "notification subscribers"));
  return lines;
}
