import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { createAdminClient } from "@/lib/supabase/admin";
import { embeddableFromHeaders, findMenuLink, isPrivateAddress, normalizeWebUrl } from "@/lib/food/menuSite";
import { parseMenu, type MenuSection } from "@/lib/food/menuItems";
import { safeWebsite } from "@/lib/food/placeSheet";

/** A restaurant's website is re-checked at most this often. */
export const MENU_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 400_000;
const MAX_REDIRECTS = 3;
// What a phone's browser says it is: sites decide framing and bot-blocking on this, and the person
// we're showing the page to is on a phone.
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/**
 * DNS lookup that refuses internal addresses at connect time (so a site that points its name at
 * 127.0.0.1 or a cloud metadata address can't turn our server into a way in).
 */
function safeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error("Blocked address"), { code: "EBLOCKED" }), "", 4);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

interface Fetched {
  status: number;
  headers: Record<string, string | undefined>;
  body: string;
  url: URL;
}

/** One GET, no redirects followed, body capped, with the safe lookup. */
function getOnce(url: URL): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      { method: "GET", lookup: safeLookup as never, timeout: FETCH_TIMEOUT_MS, headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" } },
      (res) => {
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(res.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          chunks.push(c);
          if (size >= MAX_BYTES) res.destroy();
        });
        const done = () => resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString("utf8"), url });
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** GET following up to MAX_REDIRECTS redirects, every hop re-validated as a plain public web URL. */
async function safeGet(start: URL): Promise<Fetched> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await getOnce(url);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const next = normalizeWebUrl(res.headers.location, url.toString());
      if (!next) throw new Error("Bad redirect");
      url = next;
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

const isHtml = (r: Fetched) => /html/i.test(r.headers["content-type"] ?? "");

export interface MenuSite {
  /** The page to show inside the app (the site's menu page when we found one, else its home page), or null if it can't be shown there. */
  url: string | null;
  embeddable: boolean;
}

/** Look at a restaurant's website: where its menu is, and whether it can be shown inside our page. */
export async function inspectWebsite(website: string): Promise<MenuSite> {
  const start = normalizeWebUrl(website);
  if (!start) return { url: null, embeddable: false };
  try {
    const home = await safeGet(start);
    if (home.status >= 400 || !isHtml(home)) return { url: null, embeddable: false };
    const homeOk = embeddableFromHeaders(home.headers);

    const menuLink = findMenuLink(home.body, home.url.toString());
    if (menuLink) {
      try {
        const menuPage = await safeGet(new URL(menuLink));
        // A menu page on a different host (an ordering service) often refuses framing; check it separately.
        if (menuPage.status < 400 && isHtml(menuPage) && embeddableFromHeaders(menuPage.headers)) {
          return { url: menuPage.url.toString(), embeddable: true };
        }
      } catch {
        // fall through to the home page
      }
    }
    return homeOk ? { url: home.url.toString(), embeddable: true } : { url: null, embeddable: false };
  } catch {
    return { url: null, embeddable: false };
  }
}

export type MenuInfoResult =
  | { status: "ok"; embeddable: true; url: string; host: string; kind: "menu" | "site" }
  | { status: "ok"; embeddable: false; kind?: undefined }
  /** The menu as saved by the job on the owner's Mac (tools/menu-ingest): our own screen, not the restaurant's page. */
  | { status: "ok"; embeddable: false; kind: "items"; sections: MenuSection[]; sourceUrl: string | null; host: string | null; asOf: string | null };

/**
 * What to show when someone taps Menu on a stored restaurant. A menu saved by the job on the owner's Mac comes first
 * (our own screen). Otherwise served from the 30-day memory of the restaurant's own site when fresh;
 * otherwise one look at the restaurant's own website (free: not a Google call). No website means nothing to show.
 */
export async function getMenuInfo(appId: string, placeRowId: string): Promise<MenuInfoResult> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("food_places")
    .select("id, website, menu_url, menu_embeddable, menu_checked_at, menu_items, menu_items_source_url, menu_items_at, menu_items_status")
    .eq("app_id", appId)
    .eq("id", placeRowId)
    .maybeSingle();

  const saved = row?.menu_items_status === "ok" ? parseMenu(row.menu_items) : null;
  if (row && saved) {
    const source = safeWebsite(row.menu_items_source_url);
    return { status: "ok", embeddable: false, kind: "items", sections: saved, sourceUrl: source, host: source ? new URL(source).hostname.replace(/^www\./, "") : null, asOf: row.menu_items_at };
  }
  if (!row?.website) return { status: "ok", embeddable: false };

  const fresh = row.menu_checked_at !== null && Date.now() - new Date(row.menu_checked_at).getTime() < MENU_TTL_MS;
  let site: MenuSite;
  if (fresh && row.menu_embeddable !== null) {
    site = { url: row.menu_url, embeddable: row.menu_embeddable };
  } else {
    site = await inspectWebsite(row.website);
    await admin
      .from("food_places")
      .update({ menu_url: site.url, menu_embeddable: site.embeddable, menu_checked_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  if (!site.embeddable || !site.url) return { status: "ok", embeddable: false };
  const shown = new URL(site.url);
  const homepage = new URL(row.website);
  return {
    status: "ok",
    embeddable: true,
    url: site.url,
    host: shown.hostname.replace(/^www\./, ""),
    kind: shown.pathname.replace(/\/$/, "") === homepage.pathname.replace(/\/$/, "") && shown.hostname === homepage.hostname ? "site" : "menu",
  };
}
