// Pure helpers for the menu job (no network, no browser, no model), so they can be tested.
// The job runs on the owner's Mac; see run.mjs and README.md.

export const MAX_ITEMS = 400;
export const MAX_NAME = 90;
export const MAX_DESCRIPTION = 140;
export const MIN_ITEMS = 5;
/** Prices above this are treated as a misread (the page may list a party tray, but we would rather show no price than a wrong one). */
export const MAX_PRICE = 150;
/** If more than this share of what the model returned can't be found on the page, the whole menu is rejected. */
export const MAX_DROPPED_SHARE = 0.25;

/** Lower-case, accent-free text with everything but letters and digits turned into single spaces. */
export function normalizeForMatch(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "14.95" / "$14.95" / "$ 28" → "$14.95" / "$28"; anything that isn't a plausible single price → null. */
export function cleanPrice(raw) {
  if (raw === null || raw === undefined) return null;
  const m = /(\d{1,3}(?:\.\d{1,2})?)/.exec(String(raw).replace(/,/g, ""));
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0) || n > MAX_PRICE) return null;
  // Keep the page's style: "5.00" stays "$5.00", "28" stays "$28", so a menu doesn't mix "$5" with "$15.50".
  return m[1].includes(".") ? `$${n.toFixed(2)}` : `$${n}`;
}

const clip = (s, max) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
};

/** Item names often start with a menu number ("12. Pad Thai"); the page text may or may not keep it. */
const stripNumber = (name) => name.replace(/^\s*(?:no\.?\s*)?#?\d{1,3}\s*[.)\-:]\s*/i, "");

/**
 * Whether an item name really appears in the page text (so the model can't have invented it).
 * `pageNorm` must be normalizeForMatch(pageText).
 */
export function appearsOnPage(name, pageNorm) {
  const n = normalizeForMatch(stripNumber(name));
  if (n.length < 3) return false;
  if (pageNorm.includes(n)) return true;
  // The page may break a long name across lines or reorder small words; accept when nearly every word is present nearby.
  const words = n.split(" ").filter((w) => w.length > 2);
  if (words.length < 2) return false;
  const found = words.filter((w) => pageNorm.includes(w)).length;
  return found / words.length >= 0.85 && words.length <= 8;
}

/** Splits long page text on line boundaries into pieces of at most `maxChars` (the model reads one piece at a time). */
export function chunkText(text, maxChars = 14000) {
  const chunks = [];
  let current = "";
  for (const line of String(text).split("\n")) {
    if (current && current.length + line.length + 1 > maxChars) {
      chunks.push(current);
      current = "";
    }
    // A single enormous line is cut rather than dropped.
    for (let i = 0; i < line.length; i += maxChars) {
      const piece = line.slice(i, i + maxChars);
      if (current && current.length + piece.length + 1 > maxChars) {
        chunks.push(current);
        current = "";
      }
      current += (current ? "\n" : "") + piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Joins sections from several chunks: same section name (ignoring case) is merged, repeated items are dropped. */
export function mergeSections(lists) {
  const bySection = new Map();
  for (const sections of lists) {
    for (const s of sections ?? []) {
      const key = normalizeForMatch(s.name) || "menu";
      if (!bySection.has(key)) bySection.set(key, { name: s.name || "Menu", items: [], seen: new Set() });
      const target = bySection.get(key);
      for (const item of s.items ?? []) {
        const itemKey = normalizeForMatch(item.name);
        if (!itemKey || target.seen.has(itemKey)) continue;
        target.seen.add(itemKey);
        target.items.push(item);
      }
    }
  }
  return [...bySection.values()].map(({ name, items }) => ({ name, items }));
}

/**
 * Turns the model's answer into what we store, or null if it can't be trusted.
 * Keeps only items found on the page, cleans prices, trims lengths, caps the size, and refuses a menu that
 * is too small or where too much of the answer was invented.
 */
export function sanitizeMenu(sections, pageText) {
  const pageNorm = normalizeForMatch(pageText);
  let returned = 0;
  let kept = 0;
  const out = [];
  for (const s of sections ?? []) {
    const items = [];
    for (const raw of s.items ?? []) {
      returned += 1;
      const name = clip(raw?.name, MAX_NAME);
      if (!name || !appearsOnPage(name, pageNorm)) continue;
      if (kept >= MAX_ITEMS) break;
      kept += 1;
      const description = clip(raw?.description, MAX_DESCRIPTION);
      items.push({ name, price: cleanPrice(raw?.price), description: description || null });
    }
    if (items.length) out.push({ name: clip(s.name, 60) || "Menu", items });
  }
  if (kept < MIN_ITEMS) return null;
  if (returned > 0 && (returned - kept) / returned > MAX_DROPPED_SHARE) return null;
  return { sections: out, itemCount: kept, returned };
}

// ---- finding the menu page on a restaurant's home page (same idea as src/lib/food/menuSite.ts findMenuLink) ----

const NOT_A_MENU = /toggle|hamburger|burger-?menu|nav-?menu|menu-?item|menu-?button|mobile-?menu|dropdown|sub-?menu/i;
const stripTags = (s) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&amp;/gi, " ").replace(/\s+/g, " ").trim();

export function webUrl(raw, base) {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

/** The link most likely to be the food menu, as an absolute URL, or null. Links to PDFs and images are skipped. */
export function findMenuLink(html, baseUrl) {
  let best = null;
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1];
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    if (!href) continue;
    const raw = (href[1] ?? href[2] ?? "").trim();
    if (!raw || raw.startsWith("#") || /^(javascript|mailto|tel):/i.test(raw)) continue;
    if (NOT_A_MENU.test(attrs)) continue;
    const url = webUrl(raw, baseUrl);
    if (!url || /\.(pdf|jpe?g|png|webp|gif)$/i.test(url.pathname)) continue;
    const text = stripTags(m[2]);
    let score = 0;
    if (/^(our |the |view |see |full |food |dinner |lunch )*menus?( ?(>|»|→))?$/i.test(text)) score = 3;
    else if (text.length > 0 && text.length <= 30 && /\bmenus?\b/i.test(text)) score = 2;
    else if (/\/menus?(\/|$|-|\.)/i.test(url.pathname)) score = 1;
    if (score && (!best || score > best.score)) best = { url: url.toString(), score };
  }
  return best?.url ?? null;
}

/**
 * Links to PDF files on a page that look like a menu, best first (a link or file name that says "menu" beats a plain PDF;
 * wine lists, catering sheets and the like are skipped). Absolute http(s) URLs only.
 */
export function findPdfMenuLinks(html, baseUrl) {
  const found = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[1]);
    if (!href) continue;
    const url = webUrl((href[1] ?? href[2] ?? "").trim(), baseUrl);
    if (!url || !/\.pdf$/i.test(url.pathname)) continue;
    const label = `${stripTags(m[2])} ${url.pathname} ${/\btitle\s*=\s*"([^"]*)"/i.exec(m[1])?.[1] ?? ""}`;
    if (/catering|wine|cocktail list|gift|job|application|allergen|nutrition|coupon|event|newsletter/i.test(label)) continue;
    const score = /\bmenus?\b/i.test(label) ? 2 : /food|dinner|lunch|brunch|breakfast|eat|dine/i.test(label) ? 1 : 0;
    if (!found.some((f) => f.url === url.toString())) found.push({ url: url.toString(), score });
  }
  return found.sort((a, b) => b.score - a.score).map((f) => f.url);
}

/**
 * Text items from a PDF page ({str, x, y}) → lines: items on the same baseline are joined left to right, lines top to bottom.
 * Menus put a dish and its price on one visual line, so keeping the baseline together matters.
 */
export function pdfItemsToLines(items) {
  const usable = items.filter((it) => it.str && it.str.trim()).sort((a, b) => b.y - a.y);
  const rows = [];
  for (const it of usable) {
    const row = rows[rows.length - 1];
    // Same line when the baseline is within ~3 points of the line's first item.
    if (row && Math.abs(row.y - it.y) <= 3) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  return rows
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((i) => i.str.trim()).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** The instructions given to the model for one piece of page text. */
export function buildPrompt(restaurantName, pageText) {
  return `You read the text of a restaurant web page and extract its FOOD AND DRINK MENU.
Restaurant: ${restaurantName}

Rules:
- Only items that appear on the page. Never invent items, prices or descriptions.
- Copy item names and prices exactly as written. Price is text such as "$14.95", or null when the page gives none.
- Skip navigation, cart, login, store hours, addresses, cookie notices, gift cards, rewards, and size or option lines ("Large", "Extra cheese").
- Keep each description under 100 characters, or null.
- Group items by the page's own section names (Appetizers, Entrees, ...). If there are no sections, use one section called "Menu".
- If this page is not a menu, return is_menu false and no sections.

PAGE TEXT:
${pageText}`;
}

/** The JSON shape the model must return. */
export const MENU_SCHEMA = {
  type: "object",
  properties: {
    is_menu: { type: "boolean" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, price: { type: ["string", "null"] }, description: { type: ["string", "null"] } },
              required: ["name", "price"],
            },
          },
        },
        required: ["name", "items"],
      },
    },
  },
  required: ["is_menu", "sections"],
};

// ---- menus that are photos (the page has pictures of the menu and no text) ----

export const MAX_MENU_IMAGES = 6;
/** Smaller pictures are logos, icons and food shots, not a readable menu. */
export const MIN_IMAGE_WIDTH = 600;
export const MIN_IMAGE_HEIGHT = 400;

/**
 * Which pictures on a page might be a menu, best first. `images` are {src, width, height} (natural size).
 * Keeps big ones, skips logos / icons / avatars by name, drops repeats, caps the count.
 */
export function selectMenuImages(images, max = MAX_MENU_IMAGES) {
  const seen = new Set();
  const picked = [];
  for (const img of images ?? []) {
    const src = String(img?.src ?? "");
    if (!/^https?:\/\//i.test(src) || /^data:/i.test(src)) continue;
    if (!(img.width >= MIN_IMAGE_WIDTH && img.height >= MIN_IMAGE_HEIGHT)) continue;
    if (/logo|icon|avatar|favicon|sprite|badge|trademark/i.test(src)) continue;
    const key = src.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ src, width: img.width, height: img.height, best: typeof img.best === "string" && /^https?:\/\//i.test(img.best) ? img.best : null });
  }
  return picked.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, max);
}

/** The instruction for the model that copies the words off one menu picture (a second step reads the copy into dishes). */
export const TRANSCRIBE_PROMPT = `This picture may be a restaurant menu. Copy ALL the text you can read in it, exactly as written, one line per line of the menu, top to bottom (left column first when there are columns). Keep each dish name, its price and its description on the same line. Do not translate, summarize, correct or add anything. If the picture has no menu text (a photo of food, a logo, a map), answer with exactly: NO TEXT`;

/** Joins what the model copied from several pictures; pictures with no menu text are dropped. */
export function joinTranscripts(parts) {
  return (parts ?? [])
    .map((t) => String(t ?? "").trim())
    .filter((t) => t && !/^no text\.?$/i.test(t))
    .join("\n\n");
}

/**
 * Splits a picture into overlapping tiles no bigger than `max` pixels on a side, covering all of it (an empty list = too small to bother).
 * A model reads small print more reliably when it sees it larger, so a second reading of the tiles is used to double-check the
 * first reading of the whole picture.
 */
export function tileGrid(width, height, max = 1300, overlap = 0.06) {
  const ov = Math.round(max * overlap);
  const axis = (len) => {
    if (len > max) {
      const n = Math.ceil((len - ov) / (max - ov)); // fewest tiles that cover the length with at least `ov` pixels shared
      return Array.from({ length: n }, (_, i) => {
        const start = Math.round((i * (len - max)) / (n - 1));
        return [start, start + max];
      });
    }
    // A mid-size side is split in two (the tiles get enlarged when cut), because small print is misread at that size; a small one is left whole.
    if (len >= 500) {
      const half = Math.ceil(len / 2) + Math.round(ov / 2);
      return [[0, half], [len - half, len]];
    }
    return [[0, len]];
  };
  const tiles = [];
  for (const [y0, y1] of axis(height)) for (const [x0, x1] of axis(width)) tiles.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  return tiles.length === 1 ? [] : tiles;
}

const priceValue = (p) => {
  const m = p ? /(\d+(?:\.\d+)?)/.exec(String(p)) : null;
  return m ? Number(m[1]) : null;
};

/**
 * Double-checks the prices of a picture reading against a second reading of the same picture made from zoomed tiles. Only dishes the
 * first (whole-picture) reading found are kept: tiles cut names off at their edges and spell things differently, so they are
 * never allowed to add dishes. For a dish both readings have, the price is kept when they agree or only one saw it, and dropped
 * (null) when they disagree: a missing price is better than a wrong one. Returns the sections and the names whose prices disagreed.
 */
export function mergePhotoReadings(whole, tiled) {
  const index = new Map();
  for (const s of tiled ?? []) for (const item of s.items ?? []) index.set(normalizeForMatch(item.name), item);
  const conflicts = [];
  const sections = (whole ?? []).map((s) => ({
    name: s.name,
    items: (s.items ?? []).map((item) => {
      const other = index.get(normalizeForMatch(item.name));
      if (!other) return item;
      const a = priceValue(item.price);
      const b = priceValue(other.price);
      if (a !== null && b !== null && Math.abs(a - b) > 0.001) {
        conflicts.push(item.name);
        return { ...item, price: null };
      }
      return a === null && b !== null ? { ...item, price: other.price } : item;
    }),
  }));
  return { sections, conflicts };
}
