#!/usr/bin/env node
// Spot check for saved menus: independent of the job. For each restaurant that has a saved menu it opens the saved
// source page again (or reads the PDF) and checks every dish against what the page says right next to it:
//   - the dish name is on the page,
//   - the saved price appears in the text beside that dish (a different price there = MISMATCH),
//   - a price on the page that was not saved (MISSING).
// It also counts how many priced lines the page has versus dishes saved, to spot menus that are incomplete.
// Menus read from pictures (fromPhoto) have no page text to compare with: the report lists them to check by eye.
// Usage: node audit.mjs [--names "a,b"] [--ids uuid,uuid] [--limit 40] [--json out.json]   (read-only; needs .env)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { normalizeForMatch } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const env = {};
if (existsSync(join(here, ".env"))) for (const l of readFileSync(join(here, ".env"), "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Needs tools/menu-ingest/.env");
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 LiveBitesMenuBot/1.0 (+https://livebitesnow.tapandlaunch.com)";

let q = `food_places?select=id,name,menu_items,menu_items_source_url,menu_items_at&menu_items_status=eq.ok&order=menu_items_at.desc&limit=${Number(arg("--limit") ?? 40)}`;
if (arg("--ids")) q += `&id=in.(${arg("--ids")})`;
let rows = await (await fetch(`${env.SUPABASE_URL}/rest/v1/${q}`, { headers: H })).json();
if (arg("--names")) { const names = arg("--names").split(",").map((s) => s.trim().toLowerCase()); rows = rows.filter((r) => names.some((n) => r.name.toLowerCase().includes(n))); }
const seen = new Set();
rows = rows.filter((r) => (seen.has(r.menu_items_source_url) ? false : seen.add(r.menu_items_source_url)));

const PRICE = /(?<![\d.])(\d{1,3}(?:\.\d{1,2})?)(?![\d])/g;
const nums = (s) => [...s.matchAll(PRICE)].map((m) => Number(m[1]));
const priceNum = (p) => (p ? Number(String(p).replace(/[^\d.]/g, "")) : null);

async function pageLines(browser, url) {
  if (/\.pdf($|\?)/i.test(url)) {
    const buf = new Uint8Array(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true, verbosity: 0 }).promise;
    const { pdfItemsToLines } = await import("./lib.mjs");
    const lines = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const c = await (await doc.getPage(n)).getTextContent();
      lines.push(...pdfItemsToLines(c.items.map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }))));
    }
    return lines;
  }
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: "en-US" });
  await ctx.route("**/*", (r) => (["image", "font", "media"].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 1600); await page.waitForTimeout(350); }
    return (await page.evaluate(() => document.body?.innerText ?? "")).split("\n").map((l) => l.trim()).filter(Boolean);
  } finally { await ctx.close(); }
}

const strip = (n) => normalizeForMatch(String(n).replace(/^\s*(?:no\.?\s*)?#?\d{1,3}\s*[.)\-:]\s*/i, ""));

function auditOne(menu, lines) {
  const normLines = lines.map(normalizeForMatch);
  const allKeys = new Set(menu.sections.flatMap((s) => s.items.map((i) => strip(i.name))).filter((k) => k.length >= 3));
  const pagePrices = new Set(nums(lines.join("\n")));
  const out = { items: 0, priced: 0, verified: 0, notOnPage: [], mismatch: [], missing: [], unlocated: [], pageHasPrices: lines.filter((l) => nums(l).length && /\$|\d\.\d\d/.test(l)).length };
  // A dish's block: from the line before its name to the line before the next dish's name (max 25 lines), so card layouts
  // (name, description, stars, "$", price) and "name ... price" rows are both covered.
  const isOtherDish = (j, own) => { const l = normLines[j]; for (const k of allKeys) if (k !== own && (l === k || (l.startsWith(k) && l.length <= k.length + 6))) return true; return false; };
  for (const s of menu.sections) {
    for (const it of s.items) {
      out.items++;
      const key = strip(it.name);
      const idx = [];
      normLines.forEach((l, i) => { if (key.length >= 3 && l.includes(key)) idx.push(i); });
      const sp = priceNum(it.price);
      if (sp !== null) {
        out.priced++;
        if (!pagePrices.has(sp) && ![...pagePrices].some((n) => Math.abs(n - sp) < 0.001)) out.notOnPage.push(`${it.name}: saved ${it.price} appears nowhere on the page`);
      }
      if (!idx.length) { out.unlocated.push(it.name); continue; }
      const windows = idx.map((i) => {
        let end = i + 1;
        while (end < lines.length && end <= i + 25 && !isOtherDish(end, key)) end++;
        return nums(lines.slice(Math.max(0, i - 1), end).join("\n"));
      });
      if (sp !== null) {
        if (windows.some((w) => w.some((n) => Math.abs(n - sp) < 0.001))) out.verified++;
        else if (!out.notOnPage.some((m) => m.startsWith(it.name + ":"))) out.mismatch.push(`${it.name}: saved ${it.price}, the page beside it has ${[...new Set(windows.flat())].slice(0, 6).join(", ") || "no price"}`);
      } else if (windows.some((w) => w.some((n) => n >= 1)) && /[$]|\d\.\d\d/.test(lines.slice(Math.max(0, idx[0] - 1), idx[0] + 8).join("\n"))) {
        out.missing.push(`${it.name}: page shows ${[...new Set(windows.flat())].slice(0, 4).join(", ")}`);
      }
    }
  }
  // Dishes left out: lines that carry a price but neither they nor the 3 lines before them contain any saved dish name.
  out.leftOut = [];
  lines.forEach((l, i) => {
    if (!/(?:\$\s?\d{1,3}(?:\.\d{2})?|\b\d{1,3}\.\d{2}\b)/.test(l)) return;
    const around = normLines.slice(Math.max(0, i - 3), i + 1).join(" ");
    for (const k of allKeys) if (around.includes(k)) return;
    const label = lines.slice(Math.max(0, i - 2), i + 1).join(" | ");
    if (/[a-z]{4}/i.test(label)) out.leftOut.push(label.slice(0, 110));
  });
  return out;
}

const browser = await chromium.launch({ headless: true });
const report = [];
for (const r of rows) {
  const photo = r.menu_items?.fromPhoto === true;
  const total = r.menu_items.sections.reduce((n, s) => n + s.items.length, 0);
  if (photo) { report.push({ name: r.name, id: r.id, source: r.menu_items_source_url, photo: true, items: total }); console.log(`${r.name.slice(0, 36).padEnd(36)} PHOTO menu, ${total} items: check by eye`); continue; }
  try {
    const lines = await pageLines(browser, r.menu_items_source_url);
    const a = auditOne(r.menu_items, lines);
    report.push({ name: r.name, id: r.id, source: r.menu_items_source_url, ...a });
    console.log(`${r.name.slice(0, 36).padEnd(36)} ${String(a.items).padStart(3)} items | prices ${a.verified}/${a.priced} confirmed | NOT ON PAGE ${a.notOnPage.length} | beside-mismatch ${a.mismatch.length} | price not saved ${a.missing.length} | name not found ${a.unlocated.length} | page priced lines ${a.pageHasPrices}`);
    for (const m of a.notOnPage.slice(0, 12)) console.log(`     NOT ON PAGE ${m}`);
    for (const m of a.mismatch.slice(0, 8)) console.log(`     MISMATCH  ${m}`);
    for (const m of a.missing.slice(0, 3)) console.log(`     MISSING   ${m}`);
    if (a.leftOut.length) console.log(`     LEFT OUT? ${a.leftOut.length} priced lines have no saved dish, e.g.:`);
    for (const m of a.leftOut.slice(0, 6)) console.log(`        ${m}`);
    for (const m of a.unlocated.slice(0, 3)) console.log(`     NOT FOUND ${m}`);
  } catch (e) {
    report.push({ name: r.name, id: r.id, error: String(e.message).slice(0, 100) });
    console.log(`${r.name.slice(0, 36).padEnd(36)} could not re-open source: ${String(e.message).slice(0, 80)}`);
  }
}
await browser.close();
if (arg("--json")) writeFileSync(arg("--json"), JSON.stringify(report, null, 2));
