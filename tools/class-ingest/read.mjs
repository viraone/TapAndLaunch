// FitnessNav class reader. Runs on the owner's Mac (not in the cloud), every night at 10 PM (see install-daily.sh):
// for each studio it finds the class schedule page (following the studio's own links, a few common schedule addresses,
// and booking widgets in frames), clicks through day tabs, has the local model (Ollama) list the classes, and keeps only
// classes whose name and start time appear on the page. Saves to out/ only; nothing goes to a database yet.
// Usage: node read.mjs studios.json out-dir [--only "name"]
// ANTHROPIC_API_KEY (env or .env here): read with Claude (FN_CLAUDE_MODEL, default claude-haiku-4-5), 10 studios at a time;
// without it, the local Ollama model, 3 at a time. FN_PARALLEL overrides; FN_CACHE=where schedule pages are remembered.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import robotsParser from "robots-parser";
import Anthropic from "@anthropic-ai/sdk";

const [studiosFile, outDir] = process.argv.slice(2);
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].toLowerCase() : null;
fs.mkdirSync(outDir, { recursive: true });
// Which model reads the pages. With an ANTHROPIC_API_KEY (in the environment or this folder's .env) it is Claude, hosted:
// seconds per page and many studios at once. Without one it is the local model (Ollama), which takes minutes per page.
const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
if (fs.existsSync(envFile)) for (const l of fs.readFileSync(envFile, "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const HOSTED = !!process.env.ANTHROPIC_API_KEY;
const claude = HOSTED ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 }) : null;
const CLAUDE_MODEL = process.env.FN_CLAUDE_MODEL ?? "claude-haiku-4-5";
const MODEL = "qwen3.8:27b";
// Tokens sent to and received from Claude this run, for the cost line at the end.
const usage = { input: 0, output: 0, calls: 0 };
// How many studios are read at the same time. Hosted, the model is not a bottleneck, so many; local, the browsing of one
// overlaps the model reading another's page, and more than a few just queue up.
const PARALLEL = Math.max(1, Number(process.env.FN_PARALLEL ?? (HOSTED ? 10 : 3)));
// Where each studio's schedule page was last found, so the next run goes straight there instead of searching again.
const CACHE_FILE = process.env.FN_CACHE ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "schedule-cache.json");
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch { return {}; } })();
const dbg = (...a) => process.env.FN_DEBUG && console.error("  [debug]", ...a);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 FitnessNavBot/0.1";
// "Monday, October 5, 2026" in Seattle time: the model needs it to turn "Today" / "Tomorrow" into dates.
const TODAY = new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric" });
const TODAY_ISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()); // YYYY-MM-DD

/**
 * The date a day tab or day heading stands for: "Today 10/06", "Thursday 10/08", "T 6", "Wed 7", "7 Wed", "Oct 7 Thu",
 * "Tue, Oct 06", "WEDNESDAY, OCTOBER 7", "Mon October 5, 2026", "Tomorrow Wed", "Today". Null when it names no day.
 */
function dateFromLabel(label) {
  const [ty, tm, td] = TODAY_ISO.split("-").map(Number);
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const plusDays = (n) => { const t = new Date(Date.UTC(ty, tm - 1, td + n)); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
  const l = String(label ?? "").replace(/\s+/g, " ").trim();
  let m;
  if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(l))) return m[0];
  if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(l))) {
    const mo = +m[1], d = +m[2];
    let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : ty;
    if (!m[3] && mo < tm - 6) y += 1;
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? iso(y, mo, d) : null;
  }
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  if ((m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/i.exec(l))) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, d = +m[2];
    let y = m[3] ? +m[3] : ty;
    if (!m[3] && mo < tm - 6) y += 1;
    return iso(y, mo, d);
  }
  if (/^today\b/i.test(l)) return plusDays(0);
  if (/^tomorrow\b/i.test(l)) return plusDays(1);
  if ((m = /(?:^|\s)(\d{1,2})(?:\s|$)/.exec(l)) && /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b|^[SMTWF]\s/i.test(l)) {
    // A bare day of the month next to a weekday ("T 6", "Wed 7", "7 Wed"): this month, or next month once it has passed.
    const d = +m[1];
    let mo = tm, y = ty;
    if (d < td - 1) { mo += 1; if (mo > 12) { mo = 1; y += 1; } }
    return d >= 1 && d <= 31 ? iso(y, mo, d) : null;
  }
  if ((m = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i.exec(l))) {
    const want = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(m[1].toLowerCase());
    const todayWd = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
    return plusDays((want - todayWd + 7) % 7);
  }
  return null;
}
/** A line that is only a day heading ("Wed, Oct 07", "WEDNESDAY, OCTOBER 7", "Mon October 5, 2026", "Thursday 10/08"). */
const DAY_HEADING = /^\s*(?:(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*,?\s+)?(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:PDT|PST)?\s*$/i;

// ---- robots.txt ----
const robotsCache = new Map();
async function allowed(url) {
  const origin = new URL(url).origin;
  if (!robotsCache.has(origin)) {
    let r;
    try {
      const res = await fetch(origin + "/robots.txt", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
      r = res.status >= 400 && res.status < 500 ? { all: true } : res.status >= 500 ? { none: true } : { p: robotsParser(origin + "/robots.txt", await res.text()) };
    } catch { r = { all: true }; }
    robotsCache.set(origin, r);
  }
  const r = robotsCache.get(origin);
  return r.all ? true : r.none ? false : r.p.isAllowed(url, "FitnessNavBot") !== false;
}

// ---- finding the schedule page ----
const PLATFORM = /mindbodyonline|healcode|brandedweb|marianatek|momence|vagaro|walla\.|glofox|wellnessliving|zenplanner|pike13|fitdegree|clubready|arketa|punchpass|teamup|bsport|sutra|mndbdy/i;
function scheduleLinks(links, base, places = []) {
  const scored = [];
  for (const { href, text } of links) {
    let u;
    try { u = new URL(href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || /\.(pdf|jpe?g|png)$/i.test(u.pathname)) continue;
    const t = `${text} ${u.pathname}`.toLowerCase();
    let s = 0;
    if (/class schedule|schedule|timetable|calendar/.test(t)) s += 3;
    if (/\bclasses\b|book a class|book now|reserve/.test(t)) s += 2;
    if (PLATFORM.test(u.hostname + u.pathname)) s += 2;
    // A chain's site lists every location: the one named after this studio's neighborhood wins (Studio 45: Fremont, not U-Village).
    if (s > 0 && places.some((p) => t.includes(p) || t.includes(p.replace(/ /g, "-")))) s += 5;
    if (/private|workshop|teacher training|retreat|gift|shop|blog|career|faq|policy|privacy|login|sign ?in|account|cart/.test(t)) s -= 3;
    // Online classes are not what someone looking for a studio near them wants (CorePower's /yoga-schedules/live is all livestreams).
    if (/livestream|live-stream|\/live\b|\blive\b|online|on-demand|virtual|at-home|stream/.test(t)) s -= 6;
    if (s > 0) scored.push({ url: u.toString().split("#")[0], s });
  }
  const best = new Map();
  for (const x of scored) best.set(x.url, Math.max(best.get(x.url) ?? 0, x.s));
  return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);
}

async function render(browser, url, { settle = 7000 } = {}) {
  dbg("render", url.slice(0, 90));
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 1000 }, locale: "en-US", timezoneId: "America/Los_Angeles" });
  await ctx.route("**/*", (r) => (["image", "font", "media"].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  // A Mariana Tek booking widget on the page downloads the day's classes as data for every visitor; keep that data.
  const mariana = [];
  page.on("response", async (res) => {
    if (!MARIANA_API.test(res.url()) || !res.ok()) return;
    try { const j = await res.json(); const rows = j.results ?? j.data; if (Array.isArray(rows)) mariana.push(...rows); } catch {}
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(settle); // booking widgets load late
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(400); }
    // Booking calendars (Wix, Mindbody, Mariana Tek) often load only once scrolled into view, then fetch their classes.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(3000);
    // Text of the page AND every frame (schedules usually live in a booking widget's iframe).
    const parts = [];
    const walkedFrames = new Set(); // frames read day by day below: not read again whole afterwards
    // Widgets that show one day at a time (Mindbody, Mariana Tek, Wix agenda): click each day tab and read every day.
    // Day tabs read "Mon 5", "5 Mon", "Oct 1 THU" or "Today SUN"; a "next week" arrow, when there is one, gets the week after.
    for (const f of page.frames()) {
      const dayTabs = () => f.evaluate(() => {
        const WD = "(sun|mon|tue|wed|thu|fri|sat)[a-z]*\\.?", MO = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
        const res = [new RegExp(`^${WD}\\s*\\d{1,2}$`, "i"), new RegExp(`^\\d{1,2}\\s*${WD}$`, "i"), new RegExp(`^${MO}\\s*\\d{1,2}\\s+${WD}$`, "i"), new RegExp(`^(today|tomorrow)\\s+${WD}$`, "i"), /^[SMTWF]\s\d{1,2}$/, new RegExp(`^(today|${WD})\\s+\\d{1,2}/\\d{1,2}$`, "i")];
        const label = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
        const els = Array.from(document.querySelectorAll("button, a, [role=button], [role=tab], li, td, div, span")).filter((e) => e.getBoundingClientRect().width > 0 && res.some((re) => re.test(label(e))));
        return els.filter((e) => !els.some((o) => o !== e && e.contains(o))).slice(0, 8).map(label);
      }).catch(() => []);
      const clickTab = (label) => f.evaluate((want) => {
        const els = Array.from(document.querySelectorAll("button, a, [role=button], [role=tab], li, td, div, span")).filter((e) => (e.innerText || "").replace(/\s+/g, " ").trim() === want && e.getBoundingClientRect().width > 0);
        const leaf = els.find((e) => !els.some((o) => o !== e && e.contains(o)));
        if (!leaf) return false;
        leaf.click();
        return true;
      }, label).catch(() => false);
      const walk = async () => {
        const tabs = await dayTabs();
        if (tabs.length < 3) return false; // not a day strip
        const seen = [];
        for (const label of tabs) {
          if (!(await clickTab(label))) continue;
          await page.waitForTimeout(2500);
          const t = await f.evaluate(() => document.body?.innerText ?? "").catch(() => "");
          if (t.trim()) seen.push({ label, t });
        }
        // Some pages (CorePower) don't swap the day: each tab click appends that day to one growing list under day headings.
        // Reading every snapshot would hand the model the same days over and over; the last snapshot alone holds the week.
        const grows = seen.length > 1 && seen.every((x, i) => i === 0 || (x.t.length > seen[i - 1].t.length && x.t.includes(seen[i - 1].t.slice(-300))));
        if (grows) parts.push(`[All day tabs shown, in one list with day headings]\n${seen[seen.length - 1].t}`);
        else for (const { label, t } of seen) parts.push(`[Day tab shown: ${label}]\n${t}`);
        return true;
      };
      if (!(await walk())) continue;
      walkedFrames.add(f);
      for (let week = 0; week < 1; week++) {
        const clicked = await f.evaluate(() => {
          const next = Array.from(document.querySelectorAll("button, a, [role=button]")).find((e) => /next[- ]week|next-arrow/i.test((e.getAttribute("aria-label") || "") + " " + (e.getAttribute("data-hook") || "")) && e.getBoundingClientRect().width > 0);
          if (!next) return false;
          next.click();
          return true;
        }).catch(() => false);
        if (!clicked) break;
        await page.waitForTimeout(2500);
        await walk();
      }
    }
    // Week grids (SoulCycle's find-a-class page): every day is a column, and the page text flattens them so the model can't
    // tell which day a class is under. Label each column with its date instead.
    const gridFrames = new Set();
    for (const f of page.frames()) {
      const grid = await f.evaluate(() => {
        const cols = Array.from(document.querySelectorAll(".classes-week-cols .column-day[data-date]"));
        if (cols.length < 5) return null;
        const head = document.querySelector(".days-of-week-container")?.innerText ?? "";
        const m = /This Week,\s*([A-Za-z]{3,9})\s+(\d{4})/.exec(head);
        return m ? { month: m[1], year: Number(m[2]), cols: cols.map((c) => ({ day: Number(c.getAttribute("data-date")), text: (c.innerText || "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim() })) } : null;
      }).catch(() => null);
      if (!grid) continue;
      let month = new Date(`${grid.month} 1, ${grid.year}`).getMonth(), year = grid.year, prev = 0;
      for (const c of grid.cols) {
        if (c.day < prev) { month += 1; if (month > 11) { month = 0; year += 1; } }
        prev = c.day;
        parts.push(`[Day column: ${year}-${String(month + 1).padStart(2, "0")}-${String(c.day).padStart(2, "0")}]\n${c.text}`);
      }
      gridFrames.add(f);
    }
    const frameUrls = [];
    for (const f of page.frames()) {
      try {
        const t = await f.evaluate(() => document.body?.innerText ?? "");
        if (t.trim() && !gridFrames.has(f) && !walkedFrames.has(f)) parts.push(t);
        if (f !== page.mainFrame()) frameUrls.push(f.url());
      } catch {}
    }
    const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((a) => ({ href: a.getAttribute("href"), text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 60) })));
    const iframes = await page.evaluate(() => Array.from(document.querySelectorAll("iframe[src]")).map((f) => f.src));
    return { finalUrl: page.url(), text: parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(), links, frameUrls: [...new Set([...iframes, ...frameUrls])].filter((u) => /^https?:/.test(u)), mariana };
  } finally { await ctx.close(); }
}

// ---- Mariana Tek: the widget's own data instead of the model ----
// Studios on Mariana Tek (Inspire, Ahimsa, be here now., TRIBE) embed its schedule widget. The widget shows one day and keeps
// the day in the page's own address (`?_mt=/schedule/daily/<id>?activeDate=YYYY-MM-DD&locations=<id>`), and downloads that
// day's classes as data. So the week is read by loading the studio's page once per day and keeping what the widget
// downloads: exact dates and times, no model, and no clicking through day tabs (which used to land on the wrong week).
// Barry's runs the same system behind its own address (app.barrys.com/api/mt/classes), answering with `data` instead of `results`.
const MARIANA_API = /marianatek\.com\/api\/customer\/v1\/classes|\/api\/mt\/classes\?/;

function marianaDayUrl(pageUrl, date) {
  const u = new URL(pageUrl);
  const mt = u.searchParams.get("_mt");
  if (!mt) return null;
  const [path, query = ""] = mt.split("?");
  const q = new URLSearchParams(query);
  q.set("activeDate", date);
  u.searchParams.set("_mt", `${path}?${q.toString()}`);
  return u.toString();
}

async function marianaDay(browser, url) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 1000 }, locale: "en-US", timezoneId: "America/Los_Angeles" });
  await ctx.route("**/*", (r) => (["image", "font", "media"].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  const got = [];
  page.on("response", async (res) => {
    if (!MARIANA_API.test(res.url()) || !res.ok()) return;
    try { const j = await res.json(); const rows = j.results ?? j.data; if (Array.isArray(rows)) got.push(...rows); } catch {}
  });
  try {
    const waited = page.waitForResponse((res) => MARIANA_API.test(res.url()), { timeout: 20000 }).catch(() => null);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waited;
    await page.waitForTimeout(1500); // the response handler above finishes reading the body
    return got;
  } finally { await ctx.close(); }
}

/** The widget's class records as the rows the app shows. Cancelled classes are left out. */
function marianaClasses(records) {
  const seen = new Set();
  const out = [];
  for (const c of records) {
    if (!c || c.is_cancelled || seen.has(c.id)) continue;
    seen.add(c.id);
    const start = String(c.start_time ?? "").slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(c.start_date ?? "")) continue;
    const minutes = Number(c.class_type?.duration) || 0;
    let end = null;
    if (minutes) { const [h, m] = start.split(":").map(Number); const t = h * 60 + m + minutes; end = `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; }
    const who = (c.instructors ?? []).map((i) => i?.name || [i?.first_name, i?.last_name].filter(Boolean).join(" ")).filter(Boolean).join(", ") || null;
    const cap = Number(c.capacity) || 0;
    const left = Number(c.available_spot_count) || 0;
    const spots = cap > 0 && c.is_remaining_spot_count_public !== false ? (left > 0 ? `${left} spot${left === 1 ? "" : "s"} left` : "Full") : null;
    out.push({ date: c.start_date, start, end, name: String(c.class_type?.name ?? c.name ?? "Class").trim(), instructor: who, spots });
  }
  return out.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
}

/** The coming week, read from the widget: 8 days, so a night-time read still fills the next morning's full week. Null when the page has no Mariana Tek widget. */
async function readMariana(browser, pg) {
  if (!pg.mariana?.length) return null;
  const records = [...pg.mariana];
  const first = marianaDayUrl(pg.finalUrl, "2000-01-01");
  if (first) {
    const base = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const days = Array.from({ length: 8 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
    for (const day of days) {
      const url = marianaDayUrl(pg.finalUrl, day);
      try { records.push(...(await marianaDay(browser, url))); } catch (e) { dbg("mariana day failed", day, String(e.message).slice(0, 60)); }
    }
  }
  const classes = marianaClasses(records);
  return classes.length ? { classes, days: new Set(classes.map((c) => c.date)).size } : null;
}

// ---- the model ----
const SCHEMA = { type: "object", properties: { is_schedule: { type: "boolean" }, classes: { type: "array", items: { type: "object", properties: { date: { type: ["string", "null"] }, start: { type: "string" }, end: { type: ["string", "null"] }, name: { type: "string" }, instructor: { type: ["string", "null"] }, spots: { type: ["string", "null"] } }, required: ["date", "start", "end", "name", "instructor", "spots"] } } }, required: ["is_schedule", "classes"] };
const prompt = (studio, text) => `You read the text of a fitness studio's web page and extract its CLASS SCHEDULE (group classes with a date and start time).
Studio: ${studio}
Today is ${TODAY}. The studio is in Seattle (Pacific time).

Rules:
- Only classes that appear in the text with a start time. Never invent classes, times, dates or instructors.
- date: "YYYY-MM-DD" for the day the class is listed under (work it out from headings like "Mon 10/5", "Tomorrow", "Today"). null if the page gives no way to tell the day.
- A line like "[Day tab shown: Thursday 10/08]" or "[Day column: 2026-10-08]" means EVERY class after it, up to the next such line, is on that day, whatever other day names appear in the text (a strip of day tabs is not a heading).
- start / end: 24-hour "HH:MM" (end null if not shown; if only a length like "50 min" is shown, work out the end).
- name: the class name exactly as written. instructor: as written, or null. spots: text like "3 spots left" / "Waitlist" / "Full", or null.
- Skip opening hours, workshops priced as events, private sessions, and anything without a start time.
- If the text has no class schedule, return is_schedule false and no classes.

PAGE TEXT:
${text}`;
// One request to the model. A request can wait in line behind other studios', so a failure (the model busy, restarting, or slow)
// is retried once and then reported, never allowed to fail the whole studio.
async function ask(studio, text) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { return await askOnce(studio, text); } catch (e) {
      dbg("model request failed", attempt, String(e.message).slice(0, 80));
      if (attempt === 1) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  // Hosted and still failing (the key, the network, the service): the local model is the fallback when it is running.
  if (HOSTED) {
    try {
      const up = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
      if (up) { dbg("falling back to the local model"); return await askOllama(studio, text); }
    } catch {}
  }
  return { is: false, classes: [], failed: true };
}
const STRICT_SCHEMA = {
  type: "object",
  properties: {
    is_schedule: { type: "boolean" },
    classes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: ["string", "null"] },
          start: { type: "string" },
          end: { type: ["string", "null"] },
          name: { type: "string" },
          instructor: { type: ["string", "null"] },
          spots: { type: ["string", "null"] },
        },
        required: ["date", "start", "end", "name", "instructor", "spots"],
        additionalProperties: false,
      },
    },
  },
  required: ["is_schedule", "classes"],
  additionalProperties: false,
};

async function askClaude(studio, text) {
  const res = await claude.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt(studio, text) }],
    output_config: { format: { type: "json_schema", schema: STRICT_SCHEMA } },
  });
  usage.calls += 1;
  usage.input += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
  usage.output += res.usage.output_tokens;
  if (res.stop_reason === "max_tokens") dbg("claude hit max_tokens for", studio);
  const j = res.parsed_output;
  if (!j) throw new Error("Claude's answer did not match the schema");
  return { is: !!j.is_schedule, classes: j.classes ?? [] };
}

async function askOnce(studio, text) {
  return HOSTED ? askClaude(studio, text) : askOllama(studio, text);
}

async function askOllama(studio, text) {
  // Streamed: Node's fetch gives up after 5 minutes of silence before the first byte, which happens when this waits in line
  // behind another request to the model. With streaming the first bytes arrive straight away.
  const res = await fetch("http://localhost:11434/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, stream: true, think: false, format: SCHEMA, options: { temperature: 0, num_ctx: 24576, num_predict: 6000 }, messages: [{ role: "user", content: prompt(studio, text) }] }), signal: AbortSignal.timeout(6 * 60 * 1000 * PARALLEL) });
  if (!res.ok || !res.body) return { is: false, classes: [] };
  let content = "";
  let buf = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try { content += JSON.parse(line).message?.content ?? ""; } catch {}
    }
  }
  try { const j = JSON.parse(content); return { is: !!j.is_schedule, classes: j.classes ?? [] }; } catch { return { is: false, classes: [] }; }
}

// ---- checking the answer against the page ----
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function timeOnPage(hhmm, text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? ""); if (!m) return false;
  const h = +m[1], mi = m[2], h12 = ((h + 11) % 12) + 1, ap = h < 12 ? "a" : "p";
  const t = text.toLowerCase().replace(/\s+/g, " ");
  return [`${h12}:${mi} ${ap}`, `${h12}:${mi}${ap}`, `${h12}:${mi} ${ap}.m`, `${String(h).padStart(2, "0")}:${mi}`, `${h}:${mi}`, mi === "00" ? `${h12} ${ap}m` : "#", mi === "00" ? `${h12}${ap}m` : "#"].some((v) => v !== "#" && t.includes(v));
}
function verify(classes, text) {
  const pageNorm = norm(text);
  const kept = [], dropped = [];
  for (const c of classes) {
    const nameOk = norm(c.name).length >= 3 && pageNorm.includes(norm(c.name));
    const timeOk = timeOnPage(c.start, text);
    (nameOk && timeOk ? kept : dropped).push({ ...c, why: nameOk ? (timeOk ? "" : "time not on page") : "name not on page" });
  }
  // one row per (date, start, name)
  const seen = new Set();
  return { kept: kept.filter((c) => { const k = `${c.date}|${c.start}|${norm(c.name)}`; return seen.has(k) ? false : seen.add(k); }), dropped };
}
/**
 * Splits page text into day pieces: at the reader's own "[Day tab shown: …]" / "[Day column: …]" markers, and inside a
 * piece at day-heading lines when there are at least three (a week listed under headings). Each piece carries the date its
 * marker or heading names, or null when the text names no day (then the model works it out as before).
 */
function dayPieces(text) {
  const out = [];
  const marked = text.split(/^(?=\[Day (?:tab shown|column):[^\]]*\])/m);
  for (const block of marked) {
    const m = /^\[Day (?:tab shown|column):\s*([^\]]*)\]\n?/.exec(block);
    const date = m ? dateFromLabel(m[1]) : null;
    const body = m ? block.slice(m[0].length) : block;
    const lines = body.split("\n");
    const heads = lines.map((l, i) => (DAY_HEADING.test(l) && dateFromLabel(l) ? i : -1)).filter((i) => i >= 0);
    if (!date && heads.length >= 3) {
      out.push({ date: null, text: lines.slice(0, heads[0]).join("\n") });
      heads.forEach((h, k) => out.push({ date: dateFromLabel(lines[h]), text: lines.slice(h, heads[k + 1] ?? lines.length).join("\n") }));
    } else out.push({ date, text: body });
  }
  return out.filter((x) => x.text.trim());
}
const chunk = (t, n = 14000) => { const out = []; let cur = ""; for (const l of t.split("\n")) { if (cur && cur.length + l.length > n) { out.push(cur); cur = ""; } cur += (cur ? "\n" : "") + l.slice(0, n); } if (cur) out.push(cur); return out; };


// Many sites have a schedule page they don't link from the page Google gives (JETSET: /washington/fremont/schedule/).
async function guessedSchedulePages(pageUrl) {
  const u = new URL(pageUrl);
  const here = pageUrl.endsWith("/") ? pageUrl : pageUrl + "/";
  const tries = [...new Set([...["schedule/", "class-schedule/", "classes/"].map((p) => new URL(p, here).toString()), ...["/schedule", "/class-schedule", "/classes", "/book-online", "/schedule-1"].map((p) => u.origin + p)])];
  const found = [];
  await Promise.all(tries.map(async (t) => {
    try {
      const res = await fetch(t, { redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
      if (res.ok && new URL(res.url).hostname === u.hostname && res.url.replace(/\/$/, "") !== pageUrl.replace(/\/$/, "") && /sched|class|book/i.test(new URL(res.url).pathname)) found.push(res.url);
    } catch {}
  }));
  return [...new Set(found)];
}

// ---- one studio ----
const STUDIO_BUDGET_MS = HOSTED ? 10 * 60 * 1000 : 8 * 60 * 1000 * PARALLEL; // one slow or huge site must not hold up the rest (longer when studios share the local model)
async function readStudio(browser, s) {
  const t0 = Date.now();
  let modelMs = 0;
  const r = { name: s.name, kind: s.kind, site: s.site, tried: [], scheduleUrl: null, platform: null, status: "no_schedule", classes: [], dropped: [] };
  // studios.json `skip`: a studio with no group classes to list (private sessions or appointments only) is not read.
  if (s.skip) return { ...r, status: "skipped", error: s.skip };
  if (!(await allowed(s.site))) return { ...r, status: "blocked_robots" };
  const finish = (extra) => ({ ...r, ...extra, seconds: Math.round((Date.now() - t0) / 1000), modelSeconds: Math.round(modelMs / 1000) });

  // Reads one candidate schedule page. Returns the finished result when it holds classes, else null (what it dropped is kept).
  const attempt = async (url, pg) => {
    // FN_DUMP=1: keep the text the model was given, next to the result, for checking a read by hand.
    if (process.env.FN_DUMP) fs.writeFileSync(path.join(outDir, `${s.name.replace(/[^\w]+/g, "_")}.text.txt`), `${url}\n\n${pg.text}`);
    // A Mariana Tek widget on the page: the week comes from its data, exact and without the model.
    const mt = await readMariana(browser, pg);
    if (mt) return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: "marianatek", classes: mt.classes, dropped: [] });
    const all = [];
    let anySchedule = false;
    // studios.json `location`: the page lists several locations of one studio ("Capitol Hill, Studio" under each class).
    const who = s.location ? `${s.name}. IMPORTANT: this page lists several locations and shows each class's location. Return ONLY the classes held at the ${s.location} location, and none from any other location.` : s.name;
    // One request per day, with the day fixed by the tab the reader clicked or the heading the page printed, so the model
    // never has to work out which of a week's days a class sits under (it got that wrong on long pages).
    const hasTimes = (c) => /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(c);
    const pieces = dayPieces(pg.text).filter((x) => hasTimes(x.text)).slice(0, 16);
    for (const { date, text } of pieces) {
      for (const part of chunk(text)) {
        if (Date.now() - t0 > STUDIO_BUDGET_MS) break;
        dbg("ask model, chars", part.length, date ? `(day ${date})` : "");
        const m0 = Date.now();
        const a = await ask(date ? `${who}. Every class in this text is on ${date}: set date to "${date}" for all of them.` : who, part);
        modelMs += Date.now() - m0;
        if (a.failed) r.modelFailed = true;
        dbg("model answered", a.classes.length, "classes");
        if (a.is) anySchedule = true;
        all.push(...(date ? a.classes.map((c) => ({ ...c, date })) : a.classes));
      }
    }
    if (!anySchedule || all.length === 0) return null;
    const verified = verify(all, pg.text);
    // studios.json `only`: a chain's page lists every location's classes ("Strength Class (Ballard)"); a studio keeps just the
    // ones whose name matches its own location tag.
    const own = s.only ? new RegExp(s.only, "i") : null;
    const kept = own ? verified.kept.filter((c) => own.test(c.name)) : verified.kept;
    const dropped = own ? [...verified.dropped, ...verified.kept.filter((c) => !own.test(c.name))] : verified.dropped;
    if (kept.length >= 2) {
      const plat = (pg.frameUrls.join(" ") + " " + pg.finalUrl).match(PLATFORM)?.[0] ?? "own site";
      // pageUrl is the page as requested; finalUrl can carry the state of the last day tab clicked (Mindbody widgets put
      // activeDate=… in it), and remembering that would open the wrong week next time.
      return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: plat, classes: kept, dropped });
    }
    r.dropped.push(...dropped);
    return null;
  };

  const rendered = new Map(); // pages already rendered in this read (the home page), by address
  // Last time, the schedule was here: go straight to it (no home page, no link search). If it no longer works, search as usual.
  const remembered = !s.schedule ? cache[s.name]?.url : null;
  if (remembered) {
    r.tried.push(remembered);
    if (await allowed(remembered)) {
      const pg = await render(browser, remembered).catch(() => null);
      if (pg && pg.text.length >= 200) {
        const done = await attempt(remembered, pg);
        if (done) return done;
      }
    }
  }

  // s.schedule: a schedule page confirmed by hand (a chain whose pages don't say which location they show, or a studio whose
  // home page lists a few upcoming classes that would otherwise pass for the schedule). Only that page is read.
  let order;
  if (s.schedule) order = [s.schedule];
  else {
    const home = await render(browser, s.site, { settle: 3000 });
    // "West Queen Anne" should still match a "Queen Anne" link.
    const hood = s.neighborhood ? [s.neighborhood, s.neighborhood.replace(/^(north|south|east|west|upper|lower)\s+/i, "")] : [];
    const places = [...new Set([...hood, ...s.name.split(/\s[-|–]\s|[()]/).slice(1)].filter(Boolean).map((x) => x.toLowerCase().trim()).filter((x) => x.length >= 4))];
    const linked = [...home.frameUrls.filter((u) => PLATFORM.test(u)), ...scheduleLinks(home.links, home.finalUrl, places)];
    const candidates = [...new Set([...linked.slice(0, 3), ...(await guessedSchedulePages(home.finalUrl)), ...linked.slice(3)])].slice(0, 6);
    // A studio page that already lists class times (Club Pilates' location page shows the day's classes) is read first.
    const homeHasTimes = (home.text.match(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi) ?? []).length >= 5;
    order = homeHasTimes ? [home.finalUrl, ...candidates] : [...candidates, home.finalUrl];
    rendered.set(home.finalUrl, home);
  }
  for (const url of order) {
    if (Date.now() - t0 > STUDIO_BUDGET_MS) break;
    if (r.tried.includes(url)) continue;
    r.tried.push(url);
    if (!(await allowed(url))) { r.status = "blocked_robots"; continue; }
    const pg = rendered.get(url) ?? (await render(browser, url).catch(() => null));
    if (!pg || pg.text.length < 200) continue;
    const done = await attempt(url, pg);
    if (done) return done;
  }
  return finish(r.modelFailed ? { status: "error", error: "the model did not answer" } : {});
}

const studios = JSON.parse(fs.readFileSync(studiosFile, "utf8")).filter((s) => !only || s.name.toLowerCase().includes(only));
const browser = await chromium.launch({ headless: true });
const isHomePage = (u) => { try { const x = new URL(u); return x.pathname.replace(/\/+$/, "") === "" && !x.search; } catch { return true; } };

// A small pool: PARALLEL studios at a time. The model answers one request at a time, so what overlaps is mostly browsing.
let nextStudio = 0;
async function worker() {
  while (nextStudio < studios.length) {
    const i = nextStudio++;
    const s = studios[i];
    let r;
    try { r = await readStudio(browser, s); } catch (e) { r = { name: s.name, kind: s.kind, status: "error", error: String(e.message).slice(0, 120), classes: [] }; }
    fs.writeFileSync(`${outDir}/${s.name.replace(/[^a-z0-9]+/gi, "_")}.json`, JSON.stringify(r, null, 2));
    // Remember where the schedule was found (and forget a page that stopped working). Never the site's own home page:
    // a home page that lists today's few classes must not stand in for the schedule page on later runs.
    const worth = r.status === "ok" && r.pageUrl && !isHomePage(r.pageUrl) && r.pageUrl.replace(/\/$/, "") !== String(s.site).replace(/\/$/, "");
    if (worth) cache[s.name] = { url: r.pageUrl, at: new Date().toISOString() };
    else if (r.status === "no_schedule" && cache[s.name]) delete cache[s.name]; // only when the page itself stopped working
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1)); } catch {}
    const days = [...new Set(r.classes.map((c) => c.date))].sort();
    console.log(`[${i + 1}/${studios.length}] ${s.name.slice(0, 34).padEnd(34)} ${r.status.padEnd(14)} ${String(r.classes.length).padStart(3)} classes  days: ${days.join(",") || "-"}  via ${r.platform ?? "-"} ${r.seconds ? `(${r.seconds}s, model ${r.modelSeconds ?? 0}s)` : ""}${r.error ? " " + r.error : ""}`);
  }
}
const started = Date.now();
await Promise.all(Array.from({ length: Math.min(PARALLEL, studios.length) }, worker));
const mins = Math.round((Date.now() - started) / 6000) / 10;
if (HOSTED) {
  // Claude Haiku 4.5 list prices as of 2026-09: $1 per million tokens in, $5 per million out. An estimate, not a bill.
  const est = (usage.input / 1e6) * 1 + (usage.output / 1e6) * 5;
  console.log(`All ${studios.length} studios in ${mins} min (${PARALLEL} at a time, ${CLAUDE_MODEL}): ${usage.calls} requests, ${usage.input.toLocaleString()} tokens in, ${usage.output.toLocaleString()} out, about $${est.toFixed(2)}.`);
} else {
  console.log(`All ${studios.length} studios in ${mins} min (${PARALLEL} at a time, local ${MODEL}).`);
}
await browser.close();
