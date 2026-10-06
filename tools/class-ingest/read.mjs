// FitnessNav class reader. Runs on the owner's Mac (not in the cloud), every morning at 10 AM (see install-daily.sh):
// for each studio it finds the class schedule page (following the studio's own links, a few common schedule addresses,
// and booking widgets in frames), clicks through day tabs, has the local model (Ollama) list the classes, and keeps only
// classes whose name and start time appear on the page. Saves to out/ only; nothing goes to a database yet.
// Usage: node read.mjs studios.json out-dir [--only "name"]   (FN_PARALLEL=3 studios at a time; FN_CACHE=where schedule pages are remembered)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import robotsParser from "robots-parser";

const [studiosFile, outDir] = process.argv.slice(2);
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].toLowerCase() : null;
fs.mkdirSync(outDir, { recursive: true });
const MODEL = "qwen3.8:27b";
// How many studios are read at the same time. The browsing of one overlaps the model reading another's page.
const PARALLEL = Math.max(1, Number(process.env.FN_PARALLEL ?? 3));
// Where each studio's schedule page was last found, so the next run goes straight there instead of searching again.
const CACHE_FILE = process.env.FN_CACHE ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "schedule-cache.json");
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch { return {}; } })();
const dbg = (...a) => process.env.FN_DEBUG && console.error("  [debug]", ...a);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 FitnessNavBot/0.1";
// "Monday, October 5, 2026" in Seattle time: the model needs it to turn "Today" / "Tomorrow" into dates.
const TODAY = new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric" });

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
    // Widgets that show one day at a time (Mindbody, Mariana Tek, Wix agenda): click each day tab and read every day.
    // Day tabs read "Mon 5", "5 Mon", "Oct 1 THU" or "Today SUN"; a "next week" arrow, when there is one, gets the week after.
    for (const f of page.frames()) {
      const dayTabs = () => f.evaluate(() => {
        const WD = "(sun|mon|tue|wed|thu|fri|sat)[a-z]*\\.?", MO = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
        const res = [new RegExp(`^${WD}\\s*\\d{1,2}$`, "i"), new RegExp(`^\\d{1,2}\\s*${WD}$`, "i"), new RegExp(`^${MO}\\s*\\d{1,2}\\s+${WD}$`, "i"), new RegExp(`^(today|tomorrow)\\s+${WD}$`, "i")];
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
        for (const label of tabs) {
          if (!(await clickTab(label))) continue;
          await page.waitForTimeout(2500);
          const t = await f.evaluate(() => document.body?.innerText ?? "").catch(() => "");
          if (t.trim()) parts.push(`[Day tab shown: ${label}]\n${t}`);
        }
        return true;
      };
      if (!(await walk())) continue;
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
    const frameUrls = [];
    for (const f of page.frames()) {
      try {
        const t = await f.evaluate(() => document.body?.innerText ?? "");
        if (t.trim()) parts.push(t);
        if (f !== page.mainFrame()) frameUrls.push(f.url());
      } catch {}
    }
    const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((a) => ({ href: a.getAttribute("href"), text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 60) })));
    const iframes = await page.evaluate(() => Array.from(document.querySelectorAll("iframe[src]")).map((f) => f.src));
    return { finalUrl: page.url(), text: parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(), links, frameUrls: [...new Set([...iframes, ...frameUrls])].filter((u) => /^https?:/.test(u)) };
  } finally { await ctx.close(); }
}

// ---- the model ----
const SCHEMA = { type: "object", properties: { is_schedule: { type: "boolean" }, classes: { type: "array", items: { type: "object", properties: { date: { type: ["string", "null"] }, start: { type: "string" }, end: { type: ["string", "null"] }, name: { type: "string" }, instructor: { type: ["string", "null"] }, spots: { type: ["string", "null"] } }, required: ["date", "start", "end", "name", "instructor", "spots"] } } }, required: ["is_schedule", "classes"] };
const prompt = (studio, text) => `You read the text of a fitness studio's web page and extract its CLASS SCHEDULE (group classes with a date and start time).
Studio: ${studio}
Today is ${TODAY}. The studio is in Seattle (Pacific time).

Rules:
- Only classes that appear in the text with a start time. Never invent classes, times, dates or instructors.
- date: "YYYY-MM-DD" for the day the class is listed under (work it out from headings like "Mon 10/5", "Tomorrow", "Today"). null if the page gives no way to tell the day.
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
  return { is: false, classes: [], failed: true };
}
async function askOnce(studio, text) {
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
const STUDIO_BUDGET_MS = 8 * 60 * 1000 * PARALLEL; // one slow or huge site must not hold up the rest (longer when studios share the model)
async function readStudio(browser, s) {
  const t0 = Date.now();
  let modelMs = 0;
  const r = { name: s.name, kind: s.kind, site: s.site, tried: [], scheduleUrl: null, platform: null, status: "no_schedule", classes: [], dropped: [] };
  if (!(await allowed(s.site))) return { ...r, status: "blocked_robots" };
  const finish = (extra) => ({ ...r, ...extra, seconds: Math.round((Date.now() - t0) / 1000), modelSeconds: Math.round(modelMs / 1000) });

  // Reads one candidate schedule page. Returns the finished result when it holds classes, else null (what it dropped is kept).
  const attempt = async (url, pg) => {
    const all = [];
    let anySchedule = false;
    const withTimes = chunk(pg.text).filter((c) => /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(c)).slice(0, 8);
    for (const part of withTimes) {
      if (Date.now() - t0 > STUDIO_BUDGET_MS) break;
      dbg("ask model, chars", part.length);
      const m0 = Date.now();
      const a = await ask(s.name, part);
      modelMs += Date.now() - m0;
      if (a.failed) r.modelFailed = true;
      dbg("model answered", a.classes.length, "classes");
      if (a.is) anySchedule = true;
      all.push(...a.classes);
    }
    if (!anySchedule || all.length === 0) return null;
    const { kept, dropped } = verify(all, pg.text);
    if (kept.length >= 2) {
      const plat = (pg.frameUrls.join(" ") + " " + pg.finalUrl).match(PLATFORM)?.[0] ?? "own site";
      return finish({ status: "ok", scheduleUrl: pg.finalUrl, platform: plat, classes: kept, dropped });
    }
    r.dropped.push(...dropped);
    return null;
  };

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

  const home = await render(browser, s.site, { settle: 3000 });
  // "West Queen Anne" should still match a "Queen Anne" link.
  const hood = s.neighborhood ? [s.neighborhood, s.neighborhood.replace(/^(north|south|east|west|upper|lower)\s+/i, "")] : [];
  const places = [...new Set([...hood, ...s.name.split(/\s[-|–]\s|[()]/).slice(1)].filter(Boolean).map((x) => x.toLowerCase().trim()).filter((x) => x.length >= 4))];
  const linked = [...home.frameUrls.filter((u) => PLATFORM.test(u)), ...scheduleLinks(home.links, home.finalUrl, places)];
  // s.schedule: a schedule page confirmed by hand for a chain whose own pages don't say which location they show.
  const candidates = s.schedule ? [s.schedule] : [...new Set([...linked.slice(0, 3), ...(await guessedSchedulePages(home.finalUrl)), ...linked.slice(3)])].slice(0, 6);
  // A studio page that already lists class times (Club Pilates' location page shows the day's classes) is read first.
  const homeHasTimes = (home.text.match(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi) ?? []).length >= 5;
  for (const url of homeHasTimes ? [home.finalUrl, ...candidates] : [...candidates, home.finalUrl]) {
    if (Date.now() - t0 > STUDIO_BUDGET_MS) break;
    if (r.tried.includes(url)) continue;
    r.tried.push(url);
    if (!(await allowed(url))) { r.status = "blocked_robots"; continue; }
    const pg = url === home.finalUrl ? home : await render(browser, url).catch(() => null);
    if (!pg || pg.text.length < 200) continue;
    const done = await attempt(url, pg);
    if (done) return done;
  }
  return finish(r.modelFailed ? { status: "error", error: "the model did not answer" } : {});
}

const studios = JSON.parse(fs.readFileSync(studiosFile, "utf8")).filter((s) => !only || s.name.toLowerCase().includes(only));
const browser = await chromium.launch({ headless: true });
// A small pool: PARALLEL studios at a time. The model answers one request at a time, so what overlaps is mostly browsing.
let nextStudio = 0;
async function worker() {
  while (nextStudio < studios.length) {
    const i = nextStudio++;
    const s = studios[i];
    let r;
    try { r = await readStudio(browser, s); } catch (e) { r = { name: s.name, kind: s.kind, status: "error", error: String(e.message).slice(0, 120), classes: [] }; }
    fs.writeFileSync(`${outDir}/${s.name.replace(/[^a-z0-9]+/gi, "_")}.json`, JSON.stringify(r, null, 2));
    // Remember where the schedule was found (and forget a page that stopped working).
    if (r.status === "ok" && r.scheduleUrl) cache[s.name] = { url: r.scheduleUrl, at: new Date().toISOString() };
    else if (r.status === "no_schedule" && cache[s.name]) delete cache[s.name]; // only when the page itself stopped working
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1)); } catch {}
    const days = [...new Set(r.classes.map((c) => c.date))].sort();
    console.log(`[${i + 1}/${studios.length}] ${s.name.slice(0, 34).padEnd(34)} ${r.status.padEnd(14)} ${String(r.classes.length).padStart(3)} classes  days: ${days.join(",") || "-"}  via ${r.platform ?? "-"} ${r.seconds ? `(${r.seconds}s, model ${r.modelSeconds ?? 0}s)` : ""}${r.error ? " " + r.error : ""}`);
  }
}
const started = Date.now();
await Promise.all(Array.from({ length: Math.min(PARALLEL, studios.length) }, worker));
console.log(`All ${studios.length} studios in ${Math.round((Date.now() - started) / 60000)} min (${PARALLEL} at a time).`);
await browser.close();
