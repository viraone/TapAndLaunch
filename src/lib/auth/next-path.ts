/**
 * Where to send someone after an auth link: only a path on this site ("/reset-password"), never another site, so a
 * link in an email can't be used to bounce people to a look-alike page.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 200) return fallback;
  return raw;
}

/** `/login?next=…` and friends: the path with a `next` carried along, or plain when there is none. */
export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
