/**
 * First path segments a published app already answers itself
 * (app/published-apps/[appSlug]/<segment>): a builder page at one of these
 * would never be shown — a request to /submit reaches the form endpoint,
 * not the page. Keep in step with that folder.
 */
export const RESERVED_PAGE_PATHS = new Set([
  "app-icon",
  "bookings",
  "food",
  "gas",
  "manifest.webmanifest",
  "members",
  "orders",
  "push",
  "submit",
  "sw.js",
]);

export function isReservedPagePath(path: string): boolean {
  return RESERVED_PAGE_PATHS.has(path.split("/")[0]);
}
