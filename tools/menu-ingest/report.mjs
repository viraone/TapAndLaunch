#!/usr/bin/env node
// Sends the owner a push notification about today's run (what seed.mjs and run.mjs just did). Run last by nightly.sh.
// The server (src/app/api/food/job-report) only delivers it to the private "owner" tier of the LiveBites app, so
// visitors never see it. Quietly does nothing if there is nothing recent to report or no phone has subscribed yet.
//   node report.mjs [--print]   (--print shows the message without sending it)

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeReport } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const printOnly = process.argv.includes("--print");
const MAX_AGE_MS = 8 * 3600 * 1000;

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
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Needs tools/menu-ingest/.env with the LIVE SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
const REPORT_URL = env.REPORT_URL ?? "https://tapandlaunch.com/api/food/job-report";
const SLUG = "livebitesnow";

const recent = (file) => {
  const p = join(here, "out", file);
  if (!existsSync(p)) return undefined;
  try {
    const s = JSON.parse(readFileSync(p, "utf8"));
    return Date.now() - new Date(s.at).getTime() < MAX_AGE_MS ? s : undefined;
  } catch {
    return undefined;
  }
};
const summaries = { seed: recent("summary-seed.json"), happy: recent("summary-happy.json"), full: recent("summary-full.json") };
if (!summaries.seed && !summaries.happy && !summaries.full) {
  console.log("Nothing recent to report.");
  process.exit(0);
}

async function rest(path, head = false) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: head ? "HEAD" : "GET",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: "count=exact" },
  });
  if (!res.ok) throw new Error(`Database ${path.split("?")[0]} failed (${res.status})`);
  return head ? Number((res.headers.get("content-range") ?? "*/0").split("/")[1]) : res.json();
}

const [app] = await rest(`apps?select=id&slug=eq.${SLUG}`);
const totals = {};
try {
  totals.withHappyHour = await rest("food_places?select=id&happy_hour_status=eq.ok", true);
  totals.neverChecked = await rest("food_places?select=id&website=not.is.null&happy_hour_at=is.null", true);
} catch (e) {
  console.log(`(totals unavailable: ${e.message})`);
}
const message = composeReport(summaries, totals);
console.log(`${message.title}\n${message.body}`);
if (printOnly) process.exit(0);

const res = await fetch(REPORT_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  body: JSON.stringify({ appId: app.id, ...message }),
  signal: AbortSignal.timeout(30000),
});
const text = await res.text();
console.log(res.ok ? `Report sent: ${text}` : `Report not sent (${res.status}): ${text.slice(0, 200)}`);
