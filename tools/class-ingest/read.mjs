// FitnessNav class reader. Runs on the owner's Mac (not in the cloud), every night at 10 PM (see install-daily.sh):
// for each studio it finds the class schedule page (following the studio's own links, a few common schedule addresses,
// and booking widgets in frames), clicks through day tabs, has the local model (Ollama) list the classes, and keeps only
// classes whose name and start time appear on the page. Saves to out/ only; nothing goes to a database yet.
// Usage: node read.mjs studios.json out-dir [--only "name"]
// ANTHROPIC_API_KEY (env or .env here): read with Claude (FN_CLAUDE_MODEL, default claude-haiku-4-5), 10 studios at a time;
// without it, the local Ollama model, 3 at a time. FN_PARALLEL overrides; FN_CACHE=where schedule pages are remembered.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import robotsParser from "robots-parser";
import Anthropic from "@anthropic-ai/sdk";
import { makeHelpers } from "./helpers.mjs";

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
const { dateFromLabel, DAY_HEADING, norm, timeOnPage, verify, dayPieces, parseFcEvent, trimToTimes, parseMindbodyClassic, parseArketaCell } = makeHelpers(TODAY_ISO);

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
  // Mindbody's schedule widget (go.mindbodyonline.com/book/widgets/schedules/view/<id>/schedule): its id is enough to read
  // the week straight from the widget's own page, without the model (readMindbodyWidget).
  const mindbody = new Set();
  // FullCalendar events read exactly (parseFcEvent): `fcSeen` events were on the page, `fcClasses` of them parsed.
  let fcSeen = 0;
  const fcClasses = [];
  // Arketa calendar cells read exactly (parseArketaCell), the same way.
  let arkSeen = 0;
  const arkClasses = [];
  // Momence's schedule plugin reads a public feed (readonly-api.momence.com/host-plugins/host/<id>/…): the host id is enough.
  const momence = new Set();
  // Walla's widget calls api.hellowalla.com with the business's integration id in a header: the id is enough for the feed.
  const walla = new Set();
  page.on("request", (req) => {
    let m;
    if ((m = /go\.mindbodyonline\.com\/book\/widgets\/schedules\/view\/(\w+)\//.exec(req.url()))) mindbody.add(m[1]);
    if ((m = /readonly-api\.momence\.com\/host-plugins\/host\/(\d+)\//.exec(req.url()))) momence.add(m[1]);
    if (/api\.hellowalla\.com\/api\//.test(req.url())) { const id = req.headers()["integration-id"]; if (id) walla.add(id); }
  });
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
      if (!grid) {
        // FullCalendar (PushPress calendars: Loft Fitness, Rainier Health, 777 Strength, South Seattle CrossFit; also many
        // others): every day column carries its own date as data-date, so the columns are labelled exactly. The widget's
        // next arrow (an unlabelled icon button, or .fc-next-button) gives the second week.
        const readFc = () => f.evaluate(() => {
          const clean = (e) => (e.innerText || "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
          // The pieces of each event as the calendars print them: PushPress BoxEvent title/time/coach, Zen Planner
          // fc-event-time/fc-event-title, Fitli fc-time[data-full]/fc-title/fc-details. Read by the node side (parseFcEvent).
          const events = (col) => Array.from(col.querySelectorAll(".fc-event")).map((e) => {
            const q = (sel) => e.querySelector(sel);
            const time = q('[class*="BoxEvent-module__time"]')?.innerText || q(".fc-time")?.getAttribute("data-full") || q(".fc-event-time")?.innerText || "";
            const title = q('[class*="BoxEvent-module__title"]')?.innerText || q(".fc-title")?.innerText || q(".fc-event-title")?.innerText || "";
            const coach = q('[class*="BoxEvent-module__coach"]')?.innerText || q(".fc-details")?.innerText || "";
            return { time: time.trim(), title: title.trim(), coach: coach.trim(), raw: (e.innerText || "").replace(/\s+/g, " ").trim() };
          });
          const v5 = Array.from(document.querySelectorAll(".fc-timegrid-col[data-date], .fc-daygrid-day[data-date]")).map((c) => ({ date: c.getAttribute("data-date"), text: clean(c), events: events(c) }));
          if (v5.length >= 5) return v5;
          // FullCalendar 3/4 (Fitli): dates sit on the background table's cells, the events in a skeleton table whose cells follow the same order.
          const dates = Array.from(document.querySelectorAll(".fc-bg td[data-date]")).map((e) => e.getAttribute("data-date")).filter((d, i, a) => a.indexOf(d) === i);
          const skel = Array.from(document.querySelectorAll(".fc-content-skeleton table")).find((t) => t.querySelector(".fc-event"));
          const cells = skel ? Array.from(skel.querySelectorAll("tbody tr > td")).filter((td) => !td.classList.contains("fc-axis")) : [];
          return dates.length >= 5 && cells.length === dates.length ? dates.map((d, i) => ({ date: d, text: clean(cells[i]), events: events(cells[i]) })) : [];
        }).catch(() => []);
        const week1 = await readFc();
        if (week1.length >= 5) {
          const seenDays = new Set();
          const push = (cols) => {
            for (const c of cols) {
              if (!(c.date && c.date >= TODAY_ISO && c.text && !seenDays.has(c.date))) continue;
              seenDays.add(c.date);
              parts.push(`[Day column: ${c.date}]\n${c.text}`);
              for (const ev of c.events ?? []) { fcSeen += 1; const k = parseFcEvent(ev, c.date); if (k) fcClasses.push(k); }
            }
          };
          push(week1);
          const moved = await f.evaluate(() => {
            const el = document.querySelector(".fc-next-button") ?? Array.from(document.querySelectorAll("button[class*='icon-button'], button[aria-label*='next' i]")).filter((e) => e.getBoundingClientRect().width > 0).pop();
            if (!el) return false;
            el.click();
            return true;
          }).catch(() => false);
          if (moved) { await page.waitForTimeout(3000); push(await readFc()); }
          dbg("fullcalendar columns", f.url().slice(0, 60), "week 1:", week1.length, "next week:", moved, "days kept:", seenDays.size);
          gridFrames.add(f);
          continue;
        }
        // Arketa's list embed (app.arketa.co/iframe/<studio>/schedule: NW Fitness Project, Union Pilates, Woven Yoga): every day is an
        // h5 heading ("Sunday, Oct 11") with its class cards below; each card carries time, title, instructor and place.
        const listDays = await f.evaluate(() => Array.from(document.querySelectorAll("h5")).map((h) => ({
          label: (h.innerText || "").trim(),
          // The day's block is the nearest ancestor of the heading that holds class cards (the heading's own wrapper has none).
          cards: Array.from((() => { let a = h.parentElement; while (a && !a.querySelector('[data-testid="schedule-class-card"]')) a = a.parentElement; return a ?? h; })().querySelectorAll('[data-testid="schedule-class-card"]')).map((c) => ({
            time: c.querySelector(".dateTimeText")?.innerText?.trim() ?? "",
            name: c.querySelector(".card-title")?.innerText?.trim() ?? "",
            host: c.querySelector("p.font-weight-bold")?.innerText?.trim() ?? "",
            location: c.querySelector("span.my-1")?.innerText?.trim() ?? "",
            text: (c.innerText || "").replace(/\s+/g, " ").trim(),
          })),
        })).filter((d) => d.cards.length)).catch(() => []);
        dbg("arketa list days", f.url().slice(0, 60), listDays.length, listDays.map((d) => d.label + ":" + d.cards.length).join(" "));
        if (listDays.length) {
          for (const day of listDays) {
            const d = dateFromLabel(day.label);
            if (!d || d < TODAY_ISO) continue;
            parts.push(`[Day column: ${d}]\n${day.cards.map((c) => c.text).join("\n")}`);
            for (const cell of day.cards) { arkSeen += 1; const k = parseArketaCell(cell, d); if (k) arkClasses.push(k); }
          }
          gridFrames.add(f);
          continue;
        }
        // Arketa's calendar (Flood Yoga): seven .calendar-view__column sections under a strip of
        // .week-range__day headers ("Wed" over "7"); the text of the columns runs together without them.
        const readArk = () => f.evaluate(() => {
          const cols = Array.from(document.querySelectorAll(".calendar-view .calendar-view__column"));
          const heads = Array.from(document.querySelectorAll(".week-range__day")).map((h) => (h.innerText || "").replace(/\s+/g, " ").trim());
          if (cols.length < 5 || heads.length !== cols.length) return null;
          return cols.map((c, i) => ({
            label: heads[i],
            text: (c.innerText || "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim(),
            cells: Array.from(c.querySelectorAll("article.calendar-view__cell")).map((a) => ({
              time: a.querySelector(".calendar-view__cell-start-time")?.innerText?.trim() ?? "",
              name: a.querySelector(".calendar-view__cell-name")?.innerText?.trim() ?? "",
              host: a.querySelector(".calendar-view__cell-host")?.innerText?.trim() ?? "",
              location: a.querySelector(".calendar-view__cell-location")?.innerText?.trim() ?? "",
            })),
          }));
        }).catch(() => null);
        const ark = await readArk();
        if (!ark) continue;
        const arkDays = new Set();
        const pushArk = (cols) => {
          for (const c of cols ?? []) {
            const d = dateFromLabel(c.label);
            if (!(d && d >= TODAY_ISO && c.text && !/^No Classes$/i.test(c.text) && !arkDays.has(d))) continue;
            arkDays.add(d);
            parts.push(`[Day column: ${d}]\n${c.text}`);
            for (const cell of c.cells ?? []) { if (/^no classes$/i.test(cell.name)) continue; arkSeen += 1; const k = parseArketaCell(cell, d); if (k) arkClasses.push(k); }
          }
        };
        pushArk(ark);
        // The week's next arrow answers only a real mouse click (a click() from the page does nothing), so it is pressed from here.
        const nextArrow = f.locator(".week-range__arrow").last();
        const pressed = await nextArrow.click({ timeout: 4000 }).then(() => true, () => false);
        if (pressed) { await page.waitForTimeout(3500); pushArk(await readArk()); }
        dbg("arketa columns", f.url().slice(0, 50), "next week:", pressed, "days kept:", arkDays.size);
        gridFrames.add(f);
        continue;
      }
      let month = new Date(`${grid.month} 1, ${grid.year}`).getMonth(), year = grid.year, prev = 0;
      for (const c of grid.cols) {
        if (c.day < prev) { month += 1; if (month > 11) { month = 0; year += 1; } }
        prev = c.day;
        parts.push(`[Day column: ${year}-${String(month + 1).padStart(2, "0")}-${String(c.day).padStart(2, "0")}]\n${c.text}`);
      }
      gridFrames.add(f);
    }
    for (const f of page.frames()) {
      if (gridFrames.has(f)) continue; // its columns are already labelled with their dates; its day strip changes nothing
      if (/go\.mindbodyonline\.com\/book\/widgets\//.test(f.url())) continue; // read exactly by readMindbodyWidget: no need to click its days here
      if (/widget\.hellowalla\.com\//.test(f.url())) continue; // read from Walla's feed instead
      if (momence.size && f === page.mainFrame() && (await f.evaluate(() => !!document.querySelector(".momence-day_selection-item")).catch(() => false))) continue; // read from Momence's feed instead
      const dayTabs = () => f.evaluate(() => {
        const WD = "(sun|mon|tue|wed|thu|fri|sat)[a-z]*\\.?", MO = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
        const res = [new RegExp(`^${WD}\\s*\\d{1,2}$`, "i"), new RegExp(`^\\d{1,2}\\s*${WD}$`, "i"), new RegExp(`^${MO}\\s*\\d{1,2}\\s+${WD}$`, "i"), new RegExp(`^(today|tomorrow)\\s+${WD}$`, "i"), /^[SMTWF]\s\d{1,2}$/, new RegExp(`^(today|${WD})\\s+\\d{1,2}/\\d{1,2}$`, "i")];
        // Momence marks days that have classes with dots under the number ("WED 7 • •"): decoration, not part of the label.
        const label = (e) => (e.innerText || "").replace(/\s+/g, " ").replace(/[\s•·∙]+$/g, "").trim();
        const els = Array.from(document.querySelectorAll("button, a, [role=button], [role=tab], li, td, div, span")).filter((e) => e.getBoundingClientRect().width > 0 && res.some((re) => re.test(label(e))));
        return els.filter((e) => !els.some((o) => o !== e && e.contains(o))).slice(0, 8).map(label);
      }).catch(() => []);
      const clickTab = (label) => f.evaluate((want) => {
        const els = Array.from(document.querySelectorAll("button, a, [role=button], [role=tab], li, td, div, span")).filter((e) => (e.innerText || "").replace(/\s+/g, " ").replace(/[\s•·∙]+$/g, "").trim() === want && e.getBoundingClientRect().width > 0);
        const leaf = els.find((e) => !els.some((o) => o !== e && e.contains(o)));
        if (!leaf) return false;
        leaf.click();
        return true;
      }, label).catch(() => false);
      const walk = async () => {
        const allTabs = await dayTabs();
        if (allTabs.length < 3) return false; // not a day strip
        // Days already past have no classes to book (a Momence strip starts on the Sunday): don't read them as if they did.
        const tabs = allTabs.filter((l) => { const d = dateFromLabel(l); return !d || d >= TODAY_ISO; });
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
        // Other pages (Club Pilates, week grids like Loft Fitness) show the whole week at once and the "day tabs" are only
        // links or column headers: every snapshot is the same page. Marking each with a day would copy one week onto every
        // day, so it is handed over once, unmarked (its own day headings, if any, still split it).
        const fixed = seen.length >= 3 && new Set(seen.map((x) => x.t.replace(/\s+/g, " ").trim())).size <= Math.max(1, Math.floor(seen.length / 3));
        if (fixed) parts.push(seen.reduce((a, x) => (x.t.length > a.length ? x.t : a), ""));
        else if (grows) parts.push(`[All day tabs shown, in one list with day headings]\n${seen[seen.length - 1].t}`);
        else for (const { label, t } of seen) parts.push(`[Day tab shown: ${label}]\n${t}`);
        return true;
      };
      if (!(await walk())) continue;
      walkedFrames.add(f);
      for (let week = 0; week < 1; week++) {
        const clicked = await f.evaluate(() => {
          let next = Array.from(document.querySelectorAll("button, a, [role=button]")).find((e) => /next[- ]week|next-arrow/i.test((e.getAttribute("aria-label") || "") + " " + (e.getAttribute("data-hook") || "")) && e.getBoundingClientRect().width > 0);
          // Momence's day strip has a previous and a next arrow with no label; the next one is the last.
          if (!next) { const arrows = Array.from(document.querySelectorAll("button")).filter((e) => /day_selection-arrow/.test(e.className) && e.getBoundingClientRect().width > 0); if (arrows.length >= 2) next = arrows[arrows.length - 1]; }
          if (!next) return false;
          next.click();
          return true;
        }).catch(() => false);
        if (!clicked) break;
        await page.waitForTimeout(2500);
        await walk();
      }
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
    return { finalUrl: page.url(), text: parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(), links, frameUrls: [...new Set([...iframes, ...frameUrls])].filter((u) => /^https?:/.test(u)), mariana, mindbody: [...mindbody], momence: [...momence], walla: [...walla], fc: { seen: fcSeen, classes: fcClasses }, ark: { seen: arkSeen, classes: arkClasses } };
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

/**
 * Mindbody's current schedule widget, read from its own page: one day at a time under a strip of day chips ("Fri 9"), each
 * class a row of [time + length] [name, instructor, "Show Details"] [location] [spots] [Book]. Every row is taken as it is
 * shown, so the week is exact and the model is not needed. `location` keeps only rows whose location column names it
 * (Flow Fitness lists Fremont and South Lake Union on one widget). Returns [] when the widget shows no rows.
 */
async function readMindbodyWidget(browser, widgetId, location) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 1000 }, locale: "en-US", timezoneId: "America/Los_Angeles" });
  const page = await ctx.newPage();
  const classes = [];
  try {
    await page.goto(`https://go.mindbodyonline.com/book/widgets/schedules/view/${widgetId}/schedule`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const shownDate = () => page.evaluate(() => Array.from(document.querySelectorAll("h1, h2")).map((e) => (e.innerText || "").trim()).find((t) => /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*,\s/.test(t)) ?? null);
    const readRows = () => page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("div[class*=MuiGrid-container]")).filter((e) => e.children[0] && /^\d{1,2}:\d{2}\s?[AP]M/i.test((e.children[0].innerText || "").trim()));
      return rows.map((row) => {
        const cells = Array.from(row.children).map((c) => (c.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean));
        const staff = Array.from(row.children[1]?.querySelectorAll("button") ?? []).map((b) => (b.innerText || "").trim()).filter(Boolean);
        return { when: cells[0] ?? [], who: cells[1] ?? [], staff, where: (cells[2] ?? []).join(" "), spots: (cells[3] ?? []).join(" ") };
      });
    });
    // The day chips: "Fri 9", "Sat 10" … (today's may read "Today"); clicked in order, today onward.
    const chips = await page.evaluate(() => {
      const label = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
      const els = Array.from(document.querySelectorAll("button, [role=button], [role=tab], div, span")).filter((e) => e.getBoundingClientRect().width > 0 && /^(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*|Today)\s*\d{1,2}$/i.test(label(e)));
      return els.filter((e) => !els.some((o) => o !== e && e.contains(o))).map(label);
    });
    const days = [...new Set(chips)].map((l) => ({ label: l, date: dateFromLabel(l) })).filter((d) => d.date && d.date >= TODAY_ISO).slice(0, 8);
    for (const day of days.length ? days : [{ label: null, date: null }]) {
      if (day.label) {
        const clicked = await page.evaluate((want) => { const label = (e) => (e.innerText || "").replace(/\s+/g, " ").trim(); const els = Array.from(document.querySelectorAll("button, [role=button], [role=tab], div, span")).filter((e) => e.getBoundingClientRect().width > 0 && label(e) === want); const leaf = els.find((e) => !els.some((o) => o !== e && e.contains(o))); if (!leaf) return false; leaf.click(); return true; }, day.label);
        if (!clicked) continue;
        // The heading follows the chip ("Saturday, Oct 10"): wait for it before reading the rows.
        for (let i = 0; i < 20; i++) { const h = await shownDate(); if (h && dateFromLabel(h) === day.date) break; await page.waitForTimeout(250); }
        await page.waitForTimeout(600);
      }
      const date = day.date ?? dateFromLabel((await shownDate()) ?? "");
      if (!date) continue;
      for (const r of await readRows()) {
        const t = /^(\d{1,2}):(\d{2})\s?([AP])M/i.exec(r.when.join(" "));
        if (!t) continue;
        const h = (+t[1] % 12) + (t[3].toUpperCase() === "P" ? 12 : 0), start = `${String(h).padStart(2, "0")}:${t[2]}`;
        const mins = +(/(\d+)\s*min/i.exec(r.when.join(" "))?.[1] ?? 0);
        const end = mins ? `${String(Math.floor((h * 60 + +t[2] + mins) / 60) % 24).padStart(2, "0")}:${String((+t[2] + mins) % 60).padStart(2, "0")}` : null;
        // The name cell reads: name (one line or two), then "Instructor • Room", then "Show Details".
        const lines = r.who.filter((l) => !/^show details$/i.test(l));
        const staffAt = r.staff.length ? lines.findIndex((l) => r.staff.some((st) => l.startsWith(st))) : (lines.length > 1 ? 1 : -1);
        const name = (staffAt > 0 ? lines.slice(0, staffAt) : lines.slice(0, 1)).join(" ").replace(/\s*\|\s*$/, "").replace(/\s+/g, " ").trim();
        const instructor = r.staff[0] ?? (staffAt > 0 ? lines[staffAt].replace(/\s*•.*$/, "").trim() : null);
        if (!name) continue;
        if (location && !r.where.toLowerCase().includes(location.toLowerCase())) continue;
        const spots = /(\d+)\s*(?:of\s*\d+\s*)?(?:spots?|left|open)/i.exec(r.spots)?.[0] ?? (/waitlist/i.test(r.spots) ? "Waitlist" : null);
        classes.push({ date, start, end, name, instructor: instructor || null, spots, location: r.where || null });
      }
    }
  } catch (e) { dbg("mindbody widget", widgetId, String(e.message).slice(0, 80)); }
  finally { await ctx.close().catch(() => {}); }
  // one row per (date, start, name)
  const seen = new Set();
  return classes.filter((c) => { const k = `${c.date}|${c.start}|${c.name}`; return seen.has(k) ? false : seen.add(k); });
}
/**
 * Momence's public schedule feed for a host (readonly-api.momence.com/host-plugins/host/<id>/host-schedule/sessions): every
 * session for the next 8 days, exact and without the model. Times come in UTC and are turned into Seattle time. `location`
 * keeps only sessions at that location (HIIT Lab, Core Havn and others list every club in one feed); cancelled ones are dropped.
 */
async function readMomenceFeed(hostId, location) {
  const plus = (n) => { const d = new Date(Date.UTC(+TODAY_ISO.slice(0, 4), +TODAY_ISO.slice(5, 7) - 1, +TODAY_ISO.slice(8, 10) + n)); return d.toISOString().slice(0, 10); };
  // Seattle midnight today is 07:00Z (PDT) or 08:00Z (PST); asking from 00:00Z of today over-fetches a little and the dates below sort it out.
  const base = `https://readonly-api.momence.com/host-plugins/host/${hostId}/host-schedule/sessions?sessionTypes[]=course-class&sessionTypes[]=fitness&fromDate=${TODAY_ISO}T00:00:00.000Z&toDate=${plus(9)}T00:00:00.000Z&pageSize=200&timeZone=America%2FLos_Angeles`;
  const rows = [];
  for (let page = 0; page < 10; page++) {
    const res = await fetch(`${base}&page=${page}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`momence ${res.status}`);
    const j = await res.json();
    const got = j.payload ?? [];
    rows.push(...got);
    if (got.length < 200) break;
  }
  const fmtDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
  const fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hour12: false });
  const classes = [];
  for (const r of rows) {
    if (r.isCancelled || !r.startsAt) continue;
    if (location && !String(r.location ?? "").toLowerCase().includes(location.toLowerCase())) continue;
    const st = new Date(r.startsAt), en = r.endsAt ? new Date(r.endsAt) : null;
    const date = fmtDate.format(st);
    if (date < TODAY_ISO || date > plus(8)) continue;
    const spots = r.remainingSpots?.remaining != null ? `${r.remainingSpots.remaining} of ${r.capacity ?? "?"} open` : null;
    classes.push({ date, start: fmtTime.format(st), end: en ? fmtTime.format(en) : null, name: String(r.sessionName ?? "").trim(), instructor: r.teacher ?? null, spots, location: r.location ?? null });
  }
  const seen = new Set();
  return classes.filter((c) => c.name && (seen.has(`${c.date}|${c.start}|${c.name}`) ? false : seen.add(`${c.date}|${c.start}|${c.name}`)));
}
/**
 * Walla's class feed for a business (api.hellowalla.com/api/dingo/v1/class_instances, with the widget's integration id):
 * every public class for the next 8 days, exact and without the model. Each class names its location (course.location.name),
 * so `location` keeps one club of a chain (Breathe Hot Yoga lists Capitol Hill, Belltown and West Seattle in one feed).
 */
async function readWallaFeed(integrationId, location) {
  const plus = (n) => { const d = new Date(Date.UTC(+TODAY_ISO.slice(0, 4), +TODAY_ISO.slice(5, 7) - 1, +TODAY_ISO.slice(8, 10) + n)); return d.toISOString().slice(0, 10); };
  const rows = [];
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.hellowalla.com/api/dingo/v1/class_instances?page=${page}&per_page=100&sort=class_instances.start_time:asc&active=both&start_time=between%7C${TODAY_ISO}T00:00:00.000Z%7C${plus(9)}T00:00:00.000Z`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", "integration-id": integrationId, "http-jwt-aud": "widget" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`walla ${res.status}`);
    const j = await res.json();
    rows.push(...(j.records ?? []));
    if (page >= (j.total_pages ?? 1)) break;
  }
  const fmtDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
  const fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hour12: false });
  const classes = [];
  for (const r of rows) {
    if (r.active === false || r.is_public === false || !r.start_time) continue;
    const where = r.course?.location?.name ?? null;
    if (location && !String(where ?? "").toLowerCase().includes(location.toLowerCase())) continue;
    const st = new Date(r.start_time), en = r.end_time ? new Date(r.end_time) : null;
    const date = fmtDate.format(st);
    if (date < TODAY_ISO || date > plus(8)) continue;
    const name = String(r.display_name || r.name || r.course?.name || "").trim();
    const instructor = r.staff ? [r.staff.first_name, r.staff.last_name].filter(Boolean).join(" ").trim() || r.staff.nickname || null : null;
    const cap = r.in_studio_capacity, booked = r.in_person_booking_count;
    const spots = cap != null && booked != null ? (cap - booked > 0 ? `${cap - booked} of ${cap} open` : "Waitlist") : null;
    classes.push({ date, start: fmtTime.format(st), end: en ? fmtTime.format(en) : null, name, instructor, spots, location: where, online: r.available_in_person === false && r.available_as_livestream === true });
  }
  const seen = new Set();
  return classes.filter((c) => c.name && (seen.has(`${c.date}|${c.start}|${c.name}`) ? false : seen.add(`${c.date}|${c.start}|${c.name}`)));
}
/**
 * studios.json `mariana: { tenant, location }`: a studio on Mariana Tek whose own page does not hand the widget's data to the
 * reader (barre3's widget sits in an iframe that only loads the schedule on a click). The tenant's public class feed answers
 * for the week directly: exact dates, times and spots, no model. Returns the rows the app shows, [] when the feed has none.
 */
async function readMarianaFeed({ tenant, location }) {
  const plus = (n) => new Date(Date.UTC(+TODAY_ISO.slice(0, 4), +TODAY_ISO.slice(5, 7) - 1, +TODAY_ISO.slice(8, 10) + n)).toISOString().slice(0, 10);
  let url = `https://${tenant}.marianatek.com/api/customer/v1/classes?location=${encodeURIComponent(location)}&min_start_date=${TODAY_ISO}&max_start_date=${plus(8)}&page_size=200`;
  const records = [];
  for (let page = 0; url && page < 6; page++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Mariana feed ${res.status}`);
    const j = await res.json();
    records.push(...(j.results ?? []));
    url = j.next || null;
  }
  return marianaClasses(records);
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
// Last run's results (daily.sh writes to out.new next to out): a page whose text is the same as last time gets last time's
// classes back without the model. FN_PREVIOUS points elsewhere; a test run into a scratch folder finds nothing there.
const PREVIOUS_DIR = process.env.FN_PREVIOUS ?? path.join(path.dirname(path.resolve(outDir)), "out");
const resultFile = (dir, name) => path.join(dir, `${name.replace(/[^a-z0-9]+/gi, "_")}.json`);
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
  // studios.json `schedules`: a studio that splits its week across several pages (Olympic Athletic Club: morning, afternoon and
  // evening). Each page is read as its own studio would be, and the classes are put together.
  if (Array.isArray(s.schedules) && s.schedules.length) {
    const subs = [];
    for (const u of s.schedules) subs.push(await readStudio(browser, { ...s, schedules: undefined, schedule: u }));
    const good = subs.filter((x) => x.status === "ok");
    if (!good.length) return { ...subs[0], tried: subs.flatMap((x) => x.tried ?? []) };
    const seen = new Set(), classes = [];
    for (const c of good.flatMap((x) => x.classes)) { const k = `${c.date}|${c.start}|${c.name}`; if (!seen.has(k)) { seen.add(k); classes.push(c); } }
    return { ...good[0], classes, tried: subs.flatMap((x) => x.tried ?? []), dropped: subs.flatMap((x) => x.dropped ?? []), seconds: subs.reduce((a, x) => a + (x.seconds ?? 0), 0), modelSeconds: subs.reduce((a, x) => a + (x.modelSeconds ?? 0), 0), pages: good.length + "/" + subs.length };
  }
  const t0 = Date.now();
  let modelMs = 0;
  const r = { name: s.name, kind: s.kind, site: s.site, tried: [], scheduleUrl: null, platform: null, status: "no_schedule", classes: [], dropped: [] };
  // studios.json `skip`: a studio with no group classes to list (private sessions or appointments only) is not read.
  if (s.skip) return { ...r, status: "skipped", error: s.skip };
  if (!(await allowed(s.site))) return { ...r, status: "blocked_robots" };
  const finish = (extra) => ({ ...r, ...extra, seconds: Math.round((Date.now() - t0) / 1000), modelSeconds: Math.round(modelMs / 1000) });

  // studios.json `mariana`: read the tenant's public class feed instead of the page (see readMarianaFeed).
  if (s.mariana) {
    try {
      const classes = await readMarianaFeed(s.mariana);
      if (classes.length) return finish({ status: "ok", scheduleUrl: s.site, pageUrl: s.site, platform: "marianatek", classes, dropped: [] });
      r.tried.push(`mariana feed ${s.mariana.tenant}/${s.mariana.location}: no classes`);
    } catch (e) { r.tried.push(`mariana feed ${s.mariana.tenant}/${s.mariana.location}: ${String(e.message).slice(0, 60)}`); }
  }

  // Reads one candidate schedule page. Returns the finished result when it holds classes, else null (what it dropped is kept).
  const attempt = async (url, pg) => {
    // FN_DUMP=1: keep the text the model was given, next to the result, for checking a read by hand.
    if (process.env.FN_DUMP) fs.writeFileSync(path.join(outDir, `${s.name.replace(/[^\w]+/g, "_")}.text.txt`), `${url}\n\n${pg.text}`);
    // A Mariana Tek widget on the page: the week comes from its data, exact and without the model.
    const mt = await readMariana(browser, pg);
    if (mt) return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: "marianatek", classes: mt.classes, dropped: [] });
    // A classic Mindbody schedule page (clients.mindbodyonline.com/classic/mainclass): its text is rows of time, class, teacher,
    // location and length under date headings, read as it is. An address with `sLoc=<n>` shows one location already.
    if (/clients\.mindbodyonline\.com\/classic\//.test(pg.finalUrl)) {
      const classes = parseMindbodyClassic(pg.text, s.location);
      dbg("mindbody classic rows:", classes.length);
      if (classes.length >= 3) return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: "mindbodyonline", classes, dropped: [] });
    }
    // An Arketa calendar whose cells were all read straight off the page (parseArketaCell): exact and without the model.
    if (pg.ark?.classes?.length >= 1 && pg.ark.classes.length === pg.ark.seen) {
      const own = s.only ? new RegExp(s.only, "i") : null;
      const keep = pg.ark.classes.filter((c) => (own ? own.test(c.name) : true) && (!s.location || String(c.location ?? "").toLowerCase().includes(s.location.toLowerCase())));
      const seenKeys = new Set();
      const uniq = keep.filter((c) => { const k = `${c.date}|${c.start}|${c.name}`; return seenKeys.has(k) ? false : seenKeys.add(k); });
      dbg("arketa cells read exactly:", uniq.length);
      if (uniq.length >= 1) return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: "arketa", classes: uniq, dropped: [] });
    }
    // A FullCalendar whose events were all read straight off the page (parseFcEvent): exact and without the model.
    if (pg.fc?.classes?.length >= 3 && pg.fc.classes.length === pg.fc.seen) {
      const own = s.only ? new RegExp(s.only, "i") : null;
      const classes = pg.fc.classes.filter((c) => (own ? own.test(c.name) : true) && (!s.location || true));
      const seenKeys = new Set();
      const uniq = classes.filter((c) => { const k = `${c.date}|${c.start}|${c.name}`; return seenKeys.has(k) ? false : seenKeys.add(k); });
      dbg("fullcalendar events read exactly:", uniq.length);
      if (uniq.length >= 3) return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: "fullcalendar", classes: uniq, dropped: [] });
    }
    // A Walla widget on the page: the week comes from Walla's class feed, exact and without the model.
    for (const id of pg.walla ?? []) {
      try {
        const classes = await readWallaFeed(id, s.location);
        dbg("walla feed", id.slice(0, 8), classes.length, "classes");
        if (classes.length) return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: "walla", classes, dropped: [] });
      } catch (e) { dbg("walla feed failed", String(e.message).slice(0, 60)); }
    }
    // A Momence schedule plugin on the page: the week comes from Momence's public feed, exact and without the model.
    for (const id of pg.momence ?? []) {
      try {
        const classes = await readMomenceFeed(id, s.location);
        dbg("momence feed", id, classes.length, "classes");
        if (classes.length) return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: "momence", classes, dropped: [] });
      } catch (e) { dbg("momence feed failed", id, String(e.message).slice(0, 60)); }
    }
    // A Mindbody schedule widget on the page: the week comes from the widget's own rows, exact and without the model.
    for (const id of pg.mindbody ?? []) {
      const classes = await readMindbodyWidget(browser, id, s.location);
      dbg("mindbody widget", id, classes.length, "classes");
      if (classes.length) return finish({ status: "ok", scheduleUrl: pg.finalUrl, pageUrl: url, platform: "mindbodyonline", classes, dropped: [] });
    }
    const all = [];
    let anySchedule = false;
    // studios.json `location`: the page lists several locations of one studio ("Capitol Hill, Studio" under each class).
    const who = s.location ? `${s.name}. IMPORTANT: this page lists several locations and shows each class's location. Return ONLY the classes held at the ${s.location} location, and none from any other location.` : s.name;
    // One request per day, with the day fixed by the tab the reader clicked or the heading the page printed, so the model
    // never has to work out which of a week's days a class sits under (it got that wrong on long pages).
    // "5:30amRHF CrossFit" (a calendar's cell text runs the time into the name) counts: minutes need no word boundary after am/pm.
    const hasTimes = (c) => /\b\d{1,2}:\d{2}\s*(am|pm)|\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(c);
    const pieces = dayPieces(pg.text).filter((x) => hasTimes(x.text)).slice(0, 16);
    // Same page text as the last run (and the same instructions), with every day's date fixed by the text itself: the
    // classes are the same too. Last run's answer is reused and the model is not asked. A page whose dates the model has to
    // work out from "today" is never reused, since the same words mean other days tomorrow.
    const textHash = crypto.createHash("sha1").update(`${who}|${s.only ?? ""}|${pg.text}`).digest("hex");
    if (pieces.length && pieces.every((x) => x.date) && cache[s.name]?.textHash === textHash && cache[s.name]?.url === url) {
      try {
        const prev = JSON.parse(fs.readFileSync(resultFile(PREVIOUS_DIR, s.name), "utf8"));
        if (prev.status === "ok" && prev.classes?.length) { dbg("page unchanged since last run: reusing", prev.classes.length, "classes"); return finish({ ...prev, pageUrl: url, textHash, reused: true }); }
      } catch {}
    }
    r.textHash = textHash;
    for (const { date, text } of pieces) {
      for (const part of chunk(trimToTimes(text))) {
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
    if (worth) cache[s.name] = { url: r.pageUrl, at: new Date().toISOString(), ...(r.textHash ? { textHash: r.textHash } : {}) };
    else if (r.status === "no_schedule" && cache[s.name]) delete cache[s.name]; // only when the page itself stopped working
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1)); } catch {}
    const days = [...new Set(r.classes.map((c) => c.date))].sort();
    console.log(`[${i + 1}/${studios.length}] ${s.name.slice(0, 34).padEnd(34)} ${r.status.padEnd(14)} ${String(r.classes.length).padStart(3)} classes  days: ${days.join(",") || "-"}  via ${r.reused ? "last run (page unchanged) " : ""}${r.platform ?? "-"} ${r.seconds ? `(${r.seconds}s, model ${r.modelSeconds ?? 0}s)` : ""}${r.error ? " " + r.error : ""}`);
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
