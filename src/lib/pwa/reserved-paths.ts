/**
 * First path segments a published app already answers itself
 * (app/published-apps/[appSlug]/<segment>): a builder page at one of these
 * would never be shown — a request to /submit reaches the form endpoint,
 * not the page. Keep in step with that folder.
 */
export const RESERVED_PAGE_PATHS = new Set([
  "app-code",
  "app-icon",
  "bookings",
  "fitness",
  "food",
  "gas",
  // The group chat's poll/send route lives at /group-chat/messages. The chat's own page keeps the usual /group-chat
  // address through the catch-all page; this only stops a second builder page being created on top of the API.
  "group-chat",
  "manifest.webmanifest",
  "members",
  "newsletter",
  "openmic",
  "orders",
  "robots.txt",
  "share-image",
  "sitemap.xml",
  "unsubscribe",
  "push",
  "report",
  "submit",
  "sw.js",
]);

export function isReservedPagePath(path: string): boolean {
  return RESERVED_PAGE_PATHS.has(path.split("/")[0]);
}
