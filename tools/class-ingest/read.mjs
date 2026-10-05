// FitnessNav class reader. Runs on the owner's Mac (not in the cloud), every morning at 10 AM (see install-daily.sh):
// for each studio it finds the class schedule page (following the studio's own links, a few common schedule addresses,
// and booking widgets in frames), clicks through day tabs, has the local model (Ollama) list the classes, and keeps only
// classes whose name and start time appear on the page. Saves to out/ only; nothing goes to a database yet.
// Usage: node read.mjs studios.json out-dir [--only "name"]
import fs from "node:fs";
import { chromium } from "playwright";
import robotsParser from "robots-parser";

const [studiosFile, outDir] = process.argv.slice(2);
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].toLowerCase() : null;
fs.mkdirSync(outDir, { recursive: true });
const MODEL = "qwen3.8:27b";
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
    // Widgets that show one day at a time (Mindbody, Wix agenda): click each day tab ("Mon 5" ... "Sat 10") and read every day.
    for (const f of page.frames()) {
      let n = 0;
      try {
        n = await f.evaluate(() => {
          const re = /^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\s*\d{1,2}$/i;
          const els = Array.from(document.querySelectorAll("button, a, [role=button], [role=tab], li, td, div, span"))
            .filter((e) => re.test((e.innerText || "").replace(/\s+/g, " ").trim()) && e.getBoundingClientRect().width > 0);
          const leaves = els.filter((e) => !els.some((o) => o !== e && e.contains(o)));
          leaves.slice(0, 8).forEach((e, i) => e.setAttribute("data-fn-day", String(i)));
          return Math.min(leaves.length, 8);
        });
      } catch {}
      if (n < 3) continue; // not a day strip
      for (let i = 0; i < n; i++) {
        try {
          await f.locator(`[data-fn-day="${i}"]`).first().click({ timeout: 4000 });
          await page.waitForTimeout(2500);
          const t = await f.evaluate(() => document.body?.innerText ?? "");
          if (t.trim()) parts.push(t);
        } catch {}
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
async function ask(studio, text) {
  const res = await fetch("http://localhost:11434/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, stream: false, think: false, format: SCHEMA, options: { temperature: 0, num_ctx: 24576 }, messages: [{ role: "user", content: prompt(studio, text) }] }), signal: AbortSignal.timeout(15 * 60 * 1000) });
  try { const j = JSON.parse((await res.json()).message.content); return { is: !!j.is_schedule, classes: j.classes ?? [] }; } catch { return { is: false, classes: [] }; }
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
async function readStudio(browser, s) {
  const t0 = Date.now();
  const r = { name: s.name, kind: s.kind, site: s.site, tried: [], scheduleUrl: null, platform: null, status: "no_schedule", classes: [], dropped: [] };
  if (!(await allowed(s.site))) return { ...r, status: "blocked_robots" };
  const home = await render(browser, s.site, { settle: 3000 });
  const places = [...new Set([s.neighborhood, ...s.name.split(/\s[-|–]\s|[()]/).slice(1)].filter(Boolean).map((x) => x.toLowerCase().trim()).filter((x) => x.length >= 4))];
  const linked = [...home.frameUrls.filter((u) => PLATFORM.test(u)), ...scheduleLinks(home.links, home.finalUrl, places)];
  // s.schedule: a schedule page confirmed by hand for a chain whose own pages don't say which location they show.
  const candidates = s.schedule ? [s.schedule] : [...new Set([...linked.slice(0, 3), ...(await guessedSchedulePages(home.finalUrl)), ...linked.slice(3)])].slice(0, 6);
  for (const url of [...candidates, home.finalUrl]) {
    if (r.tried.includes(url)) continue;
    r.tried.push(url);
    if (!(await allowed(url))) { r.status = "blocked_robots"; continue; }
    const pg = url === home.finalUrl ? home : await render(browser, url).catch(() => null);
    if (!pg || pg.text.length < 200) continue;
    const all = [];
    let anySchedule = false;
    for (const part of chunk(pg.text).slice(0, 8)) { const a = await ask(s.name, part); if (a.is) anySchedule = true; all.push(...a.classes); }
    if (!anySchedule || all.length === 0) continue;
    const { kept, dropped } = verify(all, pg.text);
    if (kept.length >= 2) {
      const plat = (pg.frameUrls.join(" ") + " " + pg.finalUrl).match(PLATFORM)?.[0] ?? "own site";
      return { ...r, status: "ok", scheduleUrl: pg.finalUrl, platform: plat, classes: kept, dropped, seconds: Math.round((Date.now() - t0) / 1000) };
    }
    r.dropped.push(...dropped);
  }
  return { ...r, seconds: Math.round((Date.now() - t0) / 1000) };
}

const studios = JSON.parse(fs.readFileSync(studiosFile, "utf8")).filter((s) => !only || s.name.toLowerCase().includes(only));
const browser = await chromium.launch({ headless: true });
for (const [i, s] of studios.entries()) {
  let r;
  try { r = await readStudio(browser, s); } catch (e) { r = { name: s.name, kind: s.kind, status: "error", error: String(e.message).slice(0, 120), classes: [] }; }
  fs.writeFileSync(`${outDir}/${s.name.replace(/[^a-z0-9]+/gi, "_")}.json`, JSON.stringify(r, null, 2));
  const days = [...new Set(r.classes.map((c) => c.date))].sort();
  console.log(`[${i + 1}/${studios.length}] ${s.name.slice(0, 34).padEnd(34)} ${r.status.padEnd(14)} ${String(r.classes.length).padStart(3)} classes  days: ${days.join(",") || "-"}  via ${r.platform ?? "-"} ${r.seconds ? `(${r.seconds}s)` : ""}${r.error ? " " + r.error : ""}`);
}
await browser.close();
