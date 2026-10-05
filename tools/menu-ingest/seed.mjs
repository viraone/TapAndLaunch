#!/usr/bin/env node
// LiveBites coverage seeder. Runs on the owner's Mac before the menu / happy hour job. Restaurants only exist in
// food_places once somebody has opened that spot in the app (that is what makes the one Google search per ~1 mile
// cell), so this opens every point of neighborhoods.mjs for them, within a hard Google budget, until the whole city
// is covered. It asks the live app's own /food/nearby (the same call a phone makes), so the app's own cell cache and
// 200-calls-a-day cap apply on top of the limits here. Nothing is saved except what the app itself saves.
//
//   node seed.mjs [--dry] [--limit 8] [--refresh-days 60]
//
// Limits (all must hold, or it stops): at most SEED_DAILY_CEILING Google calls counted for the app today (default 100),
// at most SEED_MONTHLY_CEILING this month (default 600, under the 1,000 free a month; phones share it), --limit points per run.
// A point is skipped while its cell's general AND bars searches are newer than --refresh-days.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pointNeedsSeeding, seedPoints } from "./neighborhoods.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const o = { dry: false, limit: 8, refreshDays: 60, site: "https://livebitesnow.tapandlaunch.com", slug: "livebitesnow", delayMs: 1500 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry") o.dry = true;
  else if (a === "--limit") o.limit = Number(argv[++i]);
  else if (a === "--refresh-days") o.refreshDays = Number(argv[++i]);
  else throw new Error(`Unknown option ${a}`);
}

function loadEnv() {
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
const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);
const DAILY = num(env.SEED_DAILY_CEILING ?? process.env.SEED_DAILY_CEILING, 100);
const MONTHLY = num(env.SEED_MONTHLY_CEILING ?? process.env.SEED_MONTHLY_CEILING, 600);
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Needs tools/menu-ingest/.env with the LIVE SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see README.md).");

async function rest(path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
  if (!res.ok) throw new Error(`Database GET ${path.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

async function usage(appId) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await rest(`food_fetch_budget?select=day,calls&app_id=eq.${appId}&day=gte.${monthStart}`);
  return { today: rows.filter((r) => r.day === today).reduce((n, r) => n + r.calls, 0), month: rows.reduce((n, r) => n + r.calls, 0) };
}

async function nearby(point, cuisine) {
  const res = await fetch(`${o.site}/food/nearby`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "LiveBitesSeeder/1.0" },
    body: JSON.stringify({ latitude: point.lat, longitude: point.lng, radiusMiles: 1, ...(cuisine ? { cuisine } : {}) }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`/food/nearby ${res.status}`);
  return res.json();
}

const summary = { step: "seed", dry: o.dry, pointsDone: 0, pointsSkipped: 0, callsUsed: 0, stopped: null, covered: [], errors: 0 };
const [app] = await rest(`apps?select=id&slug=eq.${o.slug}`);
if (!app) throw new Error(`No app with slug ${o.slug}`);
const points = seedPoints();
let u = await usage(app.id);
console.log(`${o.dry ? "DRY RUN" : "SEEDING"} | ${points.length} cells in ${new Set(points.map((p) => p.neighborhood)).size} neighborhoods | Google calls: today ${u.today}/${DAILY}, month ${u.month}/${MONTHLY}`);
const startCalls = u.month;

for (const point of points) {
  if (summary.pointsDone >= o.limit) { summary.stopped = "limit"; break; }
  if (u.today >= DAILY) { summary.stopped = "daily ceiling"; break; }
  if (u.month >= MONTHLY) { summary.stopped = "monthly ceiling"; break; }
  const fetched = await rest(`food_fetch_cells?select=fetch_group,fetched_at&app_id=eq.${app.id}&cell_key=eq.${encodeURIComponent(point.cell)}`);
  if (!pointNeedsSeeding(fetched, ["all", "bars"], o.refreshDays)) { summary.pointsSkipped++; continue; }
  if (o.dry) { console.log(`would seed ${point.neighborhood} (${point.lat}, ${point.lng})`); summary.pointsDone++; summary.covered.push(point.neighborhood); continue; }
  try {
    // The general sweep (the app adds the popular cuisines itself where an area is busy), then bars: happy hours live there.
    const general = await nearby(point);
    const bars = await nearby(point, "bars");
    summary.pointsDone++;
    summary.covered.push(point.neighborhood);
    console.log(`${point.neighborhood.padEnd(32)} ${general.places.length} places around (${bars.places.length} after bars)`);
  } catch (e) {
    summary.errors++;
    console.log(`${point.neighborhood.padEnd(32)} failed: ${e.message}`);
    if (summary.errors >= 3) { summary.stopped = "errors"; break; }
  }
  u = await usage(app.id);
  await new Promise((r) => setTimeout(r, o.delayMs));
}

u = await usage(app.id);
summary.callsUsed = u.month - startCalls;
summary.remainingCells = points.length - summary.pointsSkipped - summary.pointsDone;
console.log(`Done: ${summary.pointsDone} seeded, ${summary.pointsSkipped} already fresh, ${summary.callsUsed} Google calls used, month ${u.month}/${MONTHLY}${summary.stopped ? ` (stopped: ${summary.stopped})` : ""}`);
mkdirSync(join(here, "out"), { recursive: true });
writeFileSync(join(here, "out", "summary-seed.json"), JSON.stringify({ ...summary, at: new Date().toISOString() }, null, 2));
