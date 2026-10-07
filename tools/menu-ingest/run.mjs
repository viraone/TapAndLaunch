#!/usr/bin/env node
// LiveBites menu job. Runs on the owner's Mac (not in the cloud): for each restaurant that has a website it
//   1. checks the site's robots.txt (and skips the site if it asks bots to stay away),
//   2. opens the home page in a real headless browser, finds the Menu page and opens that too (so
//      JavaScript-built menus are read, which a server-side fetch can't do),
//   3. has a local model (Ollama, default qwen3.8:27b) read the page text into sections / dishes / prices,
//      (a menu that is a PDF, or pictures of the menu, is read too: the model copies the words off each picture first),
//   4. throws away anything that doesn't appear on the page, and
//   5. saves the result for review (out/), and to the database only when run with --write.
// See README.md. Nothing here costs money; it needs Ollama running and the Mac awake.

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import robotsParser from "robots-parser";
import { buildHappyHourPrompt, buildPrompt, chunkText, findHappyHourLink, findMenuLink, findPdfMenuLinks, HAPPY_HOUR_SCHEMA, happyHourExcerpts, joinTranscripts, MENU_SCHEMA, mentionsHappyHour, orderQueue, mergePhotoReadings, mergeSections, pdfItemsToLines, sameSite, sanitizeHappyHour, sanitizeMenu, selectMenuImages, TRANSCRIBE_PROMPT, tileGrid, webUrl } from "./lib.mjs";
import { findVeganOptions } from "./vegan.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// ---------- options ----------
function parseArgs(argv) {
  const o = { near: false, lat: 47.7063, lng: -122.3254, site: "https://livebitesnow.tapandlaunch.com", limit: 20, write: false, force: false, model: "qwen3.8:27b", maxMinutes: 180, ollama: "http://localhost:11434", delayMs: 2500, ids: null, names: null, refreshDays: 14, photos: true, happyOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--write") o.write = true;
    else if (a === "--force") o.force = true;
    else if (a === "--limit") o.limit = Number(next());
    else if (a === "--near") o.near = true;
    else if (a === "--lat") o.lat = Number(next());
    else if (a === "--lng") o.lng = Number(next());
    else if (a === "--model") o.model = next();
    else if (a === "--max-minutes") o.maxMinutes = Number(next());
    else if (a === "--ids") o.ids = next().split(",").map((s) => s.trim());
    else if (a === "--names") o.names = next().split(",").map((s) => s.trim().toLowerCase());
    else if (a === "--refresh-days") o.refreshDays = Number(next());
    else if (a === "--no-photos") o.photos = false;
    else if (a === "--happy-only") o.happyOnly = true;
    else if (a === "--help") {
      console.log("node run.mjs [--limit 20] [--near --lat 47.70 --lng -122.32] [--names 'pho an,taco del mar'] [--ids uuid,uuid] [--write] [--force] [--model qwen3.8:27b] [--max-minutes 180] [--no-photos] [--happy-only]\nWithout --write nothing is saved to the database (results are written to out/ for review).");
      process.exit(0);
    } else throw new Error(`Unknown option ${a}`);
  }
  return o;
}
const opts = parseArgs(process.argv.slice(2));

const BOT_TOKEN = "LiveBitesMenuBot";
const USER_AGENT = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 ${BOT_TOKEN}/1.0 (+https://livebitesnow.tapandlaunch.com)`;

// ---------- database (Supabase REST with the service key from .env.local; never printed) ----------
function loadEnv() {
  // Only tools/menu-ingest/.env, which holds the LIVE database keys. The repo's .env.local points at a development
  // database, so it is deliberately never read here.
  const file = join(here, ".env");
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HAVE_DB = !!(SUPABASE_URL && SERVICE_KEY);
if (opts.write && !HAVE_DB) {
  throw new Error("--write needs tools/menu-ingest/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the LIVE database (see README.md).");
}

async function rest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Database ${method} ${path.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return method === "GET" ? res.json() : null;
}

async function candidates() {
  let rows;
  if (HAVE_DB) {
    const cols = ["id", "name", "website", "address", "rating_count", "menu_items_status", "menu_items_at", "happy_hour_status", "happy_hour_at", "primary_type", "types", "app_id"];
    let q = `food_places?select=${cols.join(",")}&website=not.is.null&order=rating_count.desc.nullslast&limit=${opts.ids || opts.names ? 1000 : 1500}`;
    if (opts.ids) q += `&id=in.(${opts.ids.join(",")})`;
    // --near: only restaurants within about 2.5 miles of --lat/--lng (a box, not a circle).
    if (opts.near) q += `&latitude=gte.${opts.lat - 0.035}&latitude=lte.${opts.lat + 0.035}&longitude=gte.${opts.lng - 0.05}&longitude=lte.${opts.lng + 0.05}`;
    rows = await rest(q);
  } else {
    // No database keys: use the live site's own public list of restaurants around a point (read-only, same as the app).
    const res = await fetch(`${opts.site}/food/nearby`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ latitude: opts.lat, longitude: opts.lng, radiusMiles: 2 }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Couldn't get the restaurant list from ${opts.site} (${res.status})`);
    rows = (await res.json()).places.filter((p) => p.website).map((p) => ({ id: p.id, name: p.name, website: p.website, address: p.address, rating_count: p.ratingCount }));
    rows.sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0));
    if (opts.ids) rows = rows.filter((r) => opts.ids.includes(r.id));
  }
  if (opts.names) rows = rows.filter((r) => opts.names.some((n) => r.name.toLowerCase().includes(n)));
  if (opts.write && !opts.force) {
    const cutoff = Date.now() - opts.refreshDays * 86400000;
    const stale = (at) => !at || new Date(at).getTime() < cutoff;
    // Happy-hour-only runs care only about the happy hour check; full runs read a place when either is due.
    rows = rows.filter((r) => (opts.happyOnly ? stale(r.happy_hour_at) : stale(r.menu_items_at) || stale(r.happy_hour_at)));
  }
  // One row per website (the same restaurant can be stored once per app).
  const seen = new Set();
  rows = rows.filter((r) => (seen.has(r.website) ? false : seen.add(r.website)));
  // Bars and never-checked places first (the live-database rows carry what the ordering needs; the public dry-run list keeps its order).
  if (HAVE_DB) rows = orderQueue(rows, { happyOnly: opts.happyOnly });
  return rows.slice(0, opts.limit);
}

// ---------- the browser and the web ----------
const robotsCache = new Map();

async function robotsFor(url) {
  const origin = new URL(url).origin;
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let result;
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000), redirect: "follow" });
    if (res.status === 404 || res.status === 410 || res.status === 403 || res.status === 401) result = { allowAll: true };
    else if (res.status >= 500) result = { denyAll: true }; // can't tell: stay away
    else result = { parser: robotsParser(`${origin}/robots.txt`, await res.text()) };
  } catch {
    result = { allowAll: true }; // no robots.txt reachable at all (e.g. the site has none)
  }
  robotsCache.set(origin, result);
  return result;
}

async function allowed(url) {
  const r = await robotsFor(url);
  if (r.denyAll) return false;
  if (r.allowAll) return true;
  return r.parser.isAllowed(url, BOT_TOKEN) !== false;
}

async function render(browser, url) {
  const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 }, locale: "en-US" });
  // Pictures, fonts and video aren't needed to read a menu and only add load on the restaurant's site.
  await context.route("**/*", (route) => (["image", "font", "media"].includes(route.request().resourceType()) ? route.abort() : route.continue()));
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    const contentType = response?.headers()["content-type"] ?? "";
    if (/pdf/i.test(contentType)) return { finalUrl: page.url(), contentType, html: "", text: "" };
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    // Scroll so menus that load as you go appear.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(350);
    }
    const html = await page.content();
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    return { finalUrl: page.url(), contentType, html, text: text.replace(/\n{3,}/g, "\n\n").trim() };
  } finally {
    await context.close();
  }
}

// ---------- PDF menus ----------
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 12;

/** Downloads a PDF (size-capped, robots.txt respected) and returns its text as lines, or null. Pictures-only PDFs give no text. */
async function pdfText(url) {
  if (!(await allowed(url))) return null;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30000), redirect: "follow" });
  if (!res.ok) return null;
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_PDF_BYTES) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > MAX_PDF_BYTES || String.fromCharCode(...buf.slice(0, 4)) !== "%PDF") return null;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true, verbosity: 0 }).promise;
  const lines = [];
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PDF_PAGES); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    lines.push(...pdfItemsToLines(content.items.map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }))));
  }
  await doc.destroy();
  return lines.join("\n");
}

// ---------- menus that are pictures ----------
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Opens a page with its pictures loaded and downloads the big ones that could be a menu (PNG, JPEG or WebP). */
async function menuPictures(browser, url) {
  const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 }, locale: "en-US" });
  await context.route("**/*", (route) => (["font", "media"].includes(route.request().resourceType()) ? route.abort() : route.continue()));
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(400);
    }
    // `best` = the largest version of the picture the page offers (its srcset, up to 3200px wide): a bigger copy is the difference
    // between reading "$5.00" and misreading it as "$6.00" on small print.
    const found = await page.evaluate(() =>
      Array.from(document.images).map((i) => {
        const sets = [i.srcset, i.dataset.srcset, ...Array.from(i.closest("picture")?.querySelectorAll("source") ?? []).map((s) => s.srcset)].filter(Boolean).join(",");
        let best = null;
        let bestW = 0;
        for (const m of sets.matchAll(/(\S+)\s+(\d+)w/g)) {
          const w = Number(m[2]);
          if (w > bestW && w <= 3200) {
            bestW = w;
            best = new URL(m[1], location.href).href;
          }
        }
        return { src: i.currentSrc || i.src || i.dataset.src || "", width: i.naturalWidth, height: i.naturalHeight, best };
      })
    );
    const pictures = [];
    for (const img of selectMenuImages(found)) {
      const url = img.best ?? img.src;
      if (!(await allowed(url))) continue;
      const res = await context.request.get(url, { timeout: 30000 }).catch(() => null);
      if (!res || !res.ok()) continue;
      const type = res.headers()["content-type"] ?? "";
      if (!/image\/(png|jpe?g|webp)/i.test(type)) continue;
      const buf = await res.body();
      if (buf.length > MAX_IMAGE_BYTES) continue;
      pictures.push({ src: url, base64: buf.toString("base64"), type: type.split(";")[0].trim().toLowerCase() });
    }
    return pictures;
  } finally {
    await context.close();
  }
}

/** Cuts a picture into overlapping tiles (as PNG, base64) so small print is read at a larger size. One tile = the picture is small enough already. */
async function cutTiles(browser, pic) {
  const page = await browser.newPage();
  try {
    const dataUrl = `data:${pic.type};base64,${pic.base64}`;
    const size = await page.evaluate(async (u) => {
      const img = new Image();
      img.src = u;
      await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    }, dataUrl);
    const grid = tileGrid(size.w, size.h);
    if (grid.length === 0) return [];
    return await page.evaluate(
      async ({ u, grid }) => {
        const img = new Image();
        img.src = u;
        await img.decode();
        return grid.map((t) => {
          // Smaller tiles are enlarged (up to 2x) so the print is bigger for the model.
          const k = Math.min(2, Math.max(1, 1300 / Math.max(t.w, t.h)));
          const c = document.createElement("canvas");
          c.width = Math.round(t.w * k);
          c.height = Math.round(t.h * k);
          const ctx = c.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, t.x, t.y, t.w, t.h, 0, 0, c.width, c.height);
          return c.toDataURL("image/png").split(",")[1];
        });
      },
      { u: dataUrl, grid }
    );
  } finally {
    await page.close();
  }
}

/** Has the vision model copy the words off one picture. */
async function transcribe(base64) {
  const res = await fetch(`${opts.ollama}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      stream: false,
      think: false,
      options: { temperature: 0, num_ctx: 16384 },
      messages: [{ role: "user", content: TRANSCRIBE_PROMPT, images: [base64] }],
    }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!res.ok) throw new Error(`Model error ${res.status}`);
  return (await res.json()).message?.content ?? "";
}

// ---------- the model ----------
async function askModel(name, text) {
  const body = {
    model: opts.model,
    stream: false,
    think: false,
    format: MENU_SCHEMA,
    options: { temperature: 0, num_ctx: 24576 },
    messages: [{ role: "user", content: buildPrompt(name, text) }],
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${opts.ollama}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15 * 60 * 1000) });
    if (!res.ok) throw new Error(`Model error ${res.status}`);
    try {
      const parsed = JSON.parse((await res.json()).message.content);
      return { is_menu: !!parsed.is_menu, sections: Array.isArray(parsed.sections) ? parsed.sections : [] };
    } catch {
      // malformed JSON: ask once more
    }
  }
  return { is_menu: false, sections: [] };
}

async function extractMenu(name, text) {
  const chunks = chunkText(text, 14000).slice(0, 3); // up to ~42k characters of one page
  const lists = [];
  let anyMenu = false;
  for (const chunk of chunks) {
    const r = await askModel(name, chunk);
    if (r.is_menu) anyMenu = true;
    lists.push(r.sections);
  }
  if (!anyMenu) return { status: "not_menu" };
  const clean = sanitizeMenu(mergeSections(lists), text);
  return clean ? { status: "ok", ...clean } : { status: "unreliable" };
}

// ---------- one restaurant ----------
async function processMenu(browser, place, seen) {
  const started = Date.now();
  const result = { id: place.id, name: place.name, website: place.website, sourceUrl: null, status: "error", itemCount: 0, sections: [], model: opts.model };
  try {
    const site = webUrl(place.website);
    if (!site) return { ...result, status: "bad_url" };
    if (!(await allowed(site.toString()))) return { ...result, status: "blocked_robots" };

    const home = await render(browser, site.toString());
    if (/pdf/i.test(home.contentType)) return { ...result, status: "pdf" };
    seen.push({ url: home.finalUrl, html: home.html, text: home.text });

    const pdfLinks = findPdfMenuLinks(home.html, home.finalUrl);
    const targets = [];
    const triedPages = [];
    const link = findMenuLink(home.html, home.finalUrl);
    if (link && link !== home.finalUrl) targets.push(link);
    targets.push(null); // null = the home page itself

    for (const target of targets) {
      let pageText = home.text;
      let sourceUrl = home.finalUrl;
      if (target) {
        if (!(await allowed(target)) || !sameSite(place.website, target)) continue;
        const menuPage = await render(browser, target);
        if (!sameSite(place.website, menuPage.finalUrl)) continue; // redirected to somebody else's page
        if (/pdf/i.test(menuPage.contentType)) {
          result.status = "pdf";
          continue;
        }
        pageText = menuPage.text;
        sourceUrl = menuPage.finalUrl;
        seen.push({ url: menuPage.finalUrl, html: menuPage.html, text: menuPage.text });
        triedPages.push(menuPage.finalUrl);
        for (const u of findPdfMenuLinks(menuPage.html, menuPage.finalUrl)) if (!pdfLinks.includes(u)) pdfLinks.push(u);
      }
      if (pageText.length < 300) {
        result.status = "unreadable";
        continue;
      }
      const out = await extractMenu(place.name, pageText);
      result.status = out.status;
      if (out.status === "ok") return { ...result, ...out, sourceUrl, seconds: Math.round((Date.now() - started) / 1000) };
    }
    triedPages.push(home.finalUrl);
    // Next: a menu that is a PDF (a fifth of the menus I looked at that the pages themselves couldn't give).
    for (const pdfUrl of pdfLinks.filter((u) => sameSite(place.website, u)).slice(0, 2)) {
      const text = await pdfText(pdfUrl).catch(() => null);
      if (!text || text.length < 300) {
        result.status = result.status === "error" ? "pdf" : result.status;
        continue;
      }
      const out = await extractMenu(place.name, text);
      result.status = out.status === "ok" ? "ok" : result.status;
      if (out.status === "ok") return { ...result, ...out, sourceUrl: pdfUrl, fromPdf: true, seconds: Math.round((Date.now() - started) / 1000) };
    }
    // Last resort: the menu is pictures. The model copies the words off each one, then the same reading and
    // checking as for page text runs on that copy (so a dish still has to appear in what was copied).
    if (opts.photos) {
      for (const pageUrl of triedPages) {
        const pictures = await menuPictures(browser, pageUrl).catch(() => []);
        if (pictures.length === 0) continue;
        // Two independent readings: the whole pictures, and zoomed-in tiles of the big ones. A price is kept only where the two
        // agree or only one saw it; where they disagree it is dropped (a missing price is better than a wrong one).
        const wholeCopies = [];
        for (const pic of pictures) wholeCopies.push(await transcribe(pic.base64).catch(() => ""));
        const wholeText = joinTranscripts(wholeCopies);
        if (wholeText.length < 300) continue;
        const tileCopies = [];
        for (const pic of pictures) for (const tile of await cutTiles(browser, pic).catch(() => [])) tileCopies.push(await transcribe(tile).catch(() => ""));
        const tileText = joinTranscripts(tileCopies);
        const a = await extractMenu(place.name, wholeText);
        const b = tileText.length >= 300 ? await extractMenu(place.name, tileText) : { status: "none" };
        let sections;
        let priceChecked = false;
        let conflicts = [];
        if (a.status === "ok" && b.status === "ok") {
          const merged = mergePhotoReadings(a.sections, b.sections);
          sections = merged.sections;
          conflicts = merged.conflicts;
          priceChecked = true;
        } else if (a.status === "ok" && b.status === "none") {
          sections = a.sections; // small pictures: nothing to zoom into, the first reading is already at full size
        } else if (a.status === "ok" || b.status === "ok") {
          // Only one of two readings produced a menu: keep the dishes but not the prices, which nothing double-checked.
          sections = (a.status === "ok" ? a : b).sections.map((sec) => ({ ...sec, items: sec.items.map((i) => ({ ...i, price: null })) }));
        } else {
          result.status = a.status === "ok" ? b.status : a.status;
          continue;
        }
        const itemCount = sections.reduce((n, sec) => n + sec.items.length, 0);
        return { ...result, status: "ok", sections, itemCount, sourceUrl: pageUrl, fromPhoto: true, priceChecked, priceConflicts: conflicts, seconds: Math.round((Date.now() - started) / 1000) };
      }
    }
    return { ...result, seconds: Math.round((Date.now() - started) / 1000) };
  } catch (e) {
    return { ...result, status: "error", error: String(e.message ?? e).slice(0, 160), seconds: Math.round((Date.now() - started) / 1000) };
  }
}

// ---------- happy hour ----------
async function askHappyHour(name, excerpt) {
  const body = {
    model: opts.model,
    stream: false,
    think: false,
    format: HAPPY_HOUR_SCHEMA,
    options: { temperature: 0, num_ctx: 16384 },
    messages: [{ role: "user", content: buildHappyHourPrompt(name, excerpt) }],
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${opts.ollama}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10 * 60 * 1000) });
    if (!res.ok) throw new Error(`Model error ${res.status}`);
    try {
      const parsed = JSON.parse((await res.json()).message.content);
      return Array.isArray(parsed.windows) ? parsed.windows : [];
    } catch {
      // malformed JSON: ask once more
    }
  }
  return [];
}

/**
 * Happy hour from the pages already opened for the menu (plus the site's own "Happy Hour" link when it has one).
 * Pages that don't say "happy hour" never reach the model. Status: ok | none (pages read, no happy hour) |
 * unclear (it is mentioned but no schedule survived the checks) | error. null = nothing could be read, leave it alone.
 */
async function findHappyHour(browser, place, seen) {
  const readable = seen.filter((p) => p.text.length >= 300);
  if (readable.length === 0) return null;
  try {
    const home = seen[0];
    const link = findHappyHourLink(home.html, home.url);
    if (link && !seen.some((p) => p.url === link) && sameSite(place.website, link) && (await allowed(link))) {
      const page = await render(browser, link);
      if (sameSite(place.website, page.finalUrl) && !/pdf/i.test(page.contentType) && page.text.length >= 100) seen.push({ url: page.finalUrl, html: page.html, text: page.text });
    }
    let mentioned = false;
    for (const page of seen) {
      if (!mentionsHappyHour(page.text)) continue;
      mentioned = true;
      const windows = sanitizeHappyHour(await askHappyHour(place.name, happyHourExcerpts(page.text)), page.text).windows;
      if (windows.length > 0) return { status: "ok", windows, sourceUrl: page.url };
    }
    return { status: mentioned ? "unclear" : "none", windows: [], sourceUrl: null };
  } catch (e) {
    return { status: "error", windows: [], sourceUrl: null, error: String(e.message ?? e).slice(0, 160) };
  }
}

/** The fast pass: just the home page (and the menu page when the home page doesn't mention happy hour), no menu reading. */
async function processHappyOnly(browser, place) {
  const started = Date.now();
  const result = { id: place.id, name: place.name, website: place.website, status: "read" };
  try {
    const site = webUrl(place.website);
    if (!site) return { ...result, status: "bad_url" };
    if (!(await allowed(site.toString()))) return { ...result, status: "blocked_robots" };
    const home = await render(browser, site.toString());
    if (/pdf/i.test(home.contentType)) return { ...result, status: "pdf" };
    const seen = [{ url: home.finalUrl, html: home.html, text: home.text }];
    if (!mentionsHappyHour(home.text) && !findHappyHourLink(home.html, home.finalUrl)) {
      const link = findMenuLink(home.html, home.finalUrl);
      if (link && link !== home.finalUrl && sameSite(place.website, link) && (await allowed(link))) {
        const page = await render(browser, link);
        if (sameSite(place.website, page.finalUrl) && !/pdf/i.test(page.contentType)) seen.push({ url: page.finalUrl, html: page.html, text: page.text });
      }
    }
    const happy = await findHappyHour(browser, place, seen);
    return { ...result, ...(happy ? { happy } : { status: "unreadable" }), seconds: Math.round((Date.now() - started) / 1000) };
  } catch (e) {
    return { ...result, status: "error", error: String(e.message ?? e).slice(0, 160), seconds: Math.round((Date.now() - started) / 1000) };
  }
}

async function processPlace(browser, place) {
  if (opts.happyOnly) return processHappyOnly(browser, place);
  const seen = [];
  const result = await processMenu(browser, place, seen);
  const happy = await findHappyHour(browser, place, seen);
  return happy ? { ...result, happy } : result;
}

async function save(place, r) {
  if (opts.happyOnly) return saveHappyHour(place, r.happy);
  if (r.status === "ok") {
    await rest(`food_places?id=eq.${place.id}`, {
      method: "PATCH",
      body: {
        menu_items: r.fromPhoto ? { sections: r.sections, fromPhoto: true } : { sections: r.sections },
        menu_items_source_url: r.sourceUrl,
        menu_items_at: new Date().toISOString(),
        menu_items_status: "ok",
        menu_items_model: opts.model,
        // Vegan options come straight off the menu just read (tools/menu-ingest/vegan.mjs): no extra reading, no Google.
        ...veganColumns(r.sections),
      },
    });
  } else if (place.menu_items_status !== "ok") {
    // Remember the miss so we don't retry for a while; never replace a good saved menu with a failure.
    await rest(`food_places?id=eq.${place.id}`, { method: "PATCH", body: { menu_items_at: new Date().toISOString(), menu_items_status: r.status } });
  }
  await saveHappyHour(place, r.happy);
}

/** The vegan_options columns for a menu, found or none, stamped now. */
function veganColumns(sections) {
  const vegan = findVeganOptions({ sections });
  return { vegan_options: { items: vegan.items }, vegan_options_at: new Date().toISOString(), vegan_options_status: vegan.status };
}

async function saveHappyHour(place, h) {
  if (!h) return; // nothing could be read: leave whatever is saved
  const now = new Date().toISOString();
  if (h.status === "ok") {
    await rest(`food_places?id=eq.${place.id}`, { method: "PATCH", body: { happy_hour: { windows: h.windows }, happy_hour_source_url: h.sourceUrl, happy_hour_at: now, happy_hour_status: "ok" } });
  } else if (h.status === "none") {
    // The pages were read and don't mention it: the restaurant dropped it (or never had one).
    await rest(`food_places?id=eq.${place.id}`, { method: "PATCH", body: { happy_hour: null, happy_hour_source_url: null, happy_hour_at: now, happy_hour_status: "none" } });
  } else if (place.happy_hour_status !== "ok") {
    await rest(`food_places?id=eq.${place.id}`, { method: "PATCH", body: { happy_hour_at: now, happy_hour_status: h.status } });
  } else {
    // Never replace a good saved happy hour with a failure to read; just try again at the next refresh.
    await rest(`food_places?id=eq.${place.id}`, { method: "PATCH", body: { happy_hour_at: now } });
  }
}

// ---------- main ----------
async function main() {
  const tags = await fetch(`${opts.ollama}/api/tags`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => null);
  if (!tags) throw new Error(`Ollama isn't running at ${opts.ollama}. Start it (open the Ollama app) and try again.`);
  if (!tags.models.some((m) => m.name === opts.model)) throw new Error(`Model ${opts.model} isn't installed in Ollama. Installed: ${tags.models.map((m) => m.name).join(", ")}`);

  const places = await candidates();
  console.log(`${opts.write ? "WRITING to the LIVE database" : "DRY RUN (nothing is saved to the database)"} | model ${opts.model} | ${places.length} restaurants | limit ${opts.maxMinutes} min`);
  mkdirSync(join(here, "out"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const deadline = Date.now() + opts.maxMinutes * 60000;
  const tally = {};
  const found = [];
  let stop = false;
  process.on("SIGINT", () => {
    stop = true;
    console.log("\nStopping after this restaurant…");
  });

  try {
    for (const [i, place] of places.entries()) {
      if (stop || Date.now() > deadline) {
        console.log("Time limit or stop reached; the rest wait for the next run.");
        break;
      }
      const r = await processPlace(browser, place);
      const tallyKey = opts.happyOnly && r.happy ? `happy_${r.happy.status}` : r.status;
      tally[tallyKey] = (tally[tallyKey] ?? 0) + 1;
      if (r.happy?.status === "ok") found.push(place.name);
      writeFileSync(join(here, "out", `${place.id}.json`), JSON.stringify(r, null, 2));
      if (opts.write) await save(place, r).catch((e) => console.log(`   (save failed: ${e.message})`));
      console.log(`[${i + 1}/${places.length}] ${place.name.slice(0, 34).padEnd(34)} ${r.status.padEnd(12)} ${r.status === "ok" ? `${r.itemCount} items in ${r.sections.length} sections` : r.error ?? ""} ${r.seconds ? `(${r.seconds}s)` : ""} | happy hour: ${r.happy ? (r.happy.status === "ok" ? `${r.happy.windows.length} found` : r.happy.status) : "-"}`);
      await new Promise((res) => setTimeout(res, opts.delayMs));
    }
  } finally {
    await browser.close();
  }
  console.log("\nSummary:", JSON.stringify(tally));
  writeFileSync(join(here, "out", opts.happyOnly ? "summary-happy.json" : "summary-full.json"), JSON.stringify({ step: opts.happyOnly ? "happy" : "full", write: opts.write, read: places.length, tally, foundHappyHours: found, appIds: [...new Set(places.map((p) => p.app_id).filter(Boolean))], at: new Date().toISOString() }, null, 2));
  console.log(opts.write ? "Saved to the database." : "Dry run only: look at tools/menu-ingest/out/*.json, then run again with --write.");
}

main().catch((e) => {
  console.error("\nStopped:", e.message);
  process.exit(1);
});
