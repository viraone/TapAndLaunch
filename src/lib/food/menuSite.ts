/**
 * Pure helpers for showing a restaurant's own menu inside the app (no network here; the fetching is in
 * menuLookup.ts). Google has no menu data, so we look at the restaurant's website: find its "Menu" page,
 * and check that the site allows being shown inside another page.
 */

/** Hosts our own pages live on, which a site's frame-ancestors list may legitimately name. */
const OUR_HOST_PATTERN = /(^|\.)tapandlaunch\.com$/i;

/**
 * Whether a site's response headers allow it to be shown in an iframe on our page.
 * Sites say no with X-Frame-Options (any value: DENY, SAMEORIGIN, ...) or a CSP frame-ancestors that doesn't include us.
 */
export function embeddableFromHeaders(headers: Record<string, string | undefined>): boolean {
  const xfo = headers["x-frame-options"]?.trim();
  if (xfo) return false;
  const csp = headers["content-security-policy"] ?? "";
  // Several CSP policies can be comma-joined; every one that sets frame-ancestors must allow us.
  for (const policy of csp.split(",")) {
    const match = /(?:^|;)\s*frame-ancestors\s+([^;]*)/i.exec(policy);
    if (!match) continue;
    const sources = match[1].trim().split(/\s+/).filter(Boolean);
    const allowsUs = sources.some((s) => {
      if (s === "*" || s === "https:" || s === "http:") return true;
      const host = s.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^\*\./, "");
      return OUR_HOST_PATTERN.test(host);
    });
    if (!allowsUs) return false;
  }
  return true;
}

/** An http(s) URL on the default ports, with no embedded credentials; otherwise null. */
export function normalizeWebUrl(raw: string, base?: string): URL | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (u.port && u.port !== "80" && u.port !== "443") return null;
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

/** True for addresses a server must never be pointed at: loopback, private, link-local, carrier-grade NAT, unspecified. */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (v.includes(":")) {
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("::ffff:");
  }
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // not an address: refuse
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&amp;/gi, " ").replace(/\s+/g, " ").trim();

/** Words that make "menu" mean a page navigation toggle rather than the food menu. */
const NOT_A_MENU = /toggle|hamburger|burger-?menu|nav-?menu|menu-?item|menu-?button|mobile-?menu|dropdown|sub-?menu/i;

/**
 * The link on a restaurant's page most likely to be its food menu, as an absolute http(s) URL, or null.
 * Best: a link whose text is "Menu" / "Our menu" / "Full menu"; then text containing "menu"; then a /menu path.
 */
export function findMenuLink(html: string, baseUrl: string): string | null {
  let best: { url: string; score: number } | null = null;
  const anchors = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const m of anchors) {
    const attrs = m[1];
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    if (!href) continue;
    const raw = (href[1] ?? href[2] ?? "").trim();
    if (!raw || raw.startsWith("#") || /^(javascript|mailto|tel):/i.test(raw)) continue;
    if (NOT_A_MENU.test(attrs)) continue;
    const url = normalizeWebUrl(raw, baseUrl);
    if (!url || /\.(pdf|jpe?g|png|webp|gif)$/i.test(url.pathname)) continue;
    const text = stripTags(m[2]);
    let score = 0;
    if (/^(our |the |view |see |full |food |dinner |lunch )*menus?( ?(>|»|→))?$/i.test(text)) score = 3;
    else if (text.length > 0 && text.length <= 30 && /\bmenus?\b/i.test(text)) score = 2;
    else if (/\/menus?(\/|$|-|\.)/i.test(url.pathname)) score = 1;
    if (score === 0) continue;
    if (!best || score > best.score) best = { url: url.toString(), score };
  }
  return best?.url ?? null;
}
