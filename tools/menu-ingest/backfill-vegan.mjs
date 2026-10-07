#!/usr/bin/env node
// One-off: works out the vegan options for every menu the job has ALREADY saved (food_places.menu_items), so the app
// can show them without reading a single page again. Safe to re-run; it only touches places whose answer changed.
//
// Usage (from the job folder, which has .env with the LIVE keys):  node backfill-vegan.mjs [--dry]
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findVeganOptions } from "./vegan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes("--dry");

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
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Needs .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY next to this file.");

async function rest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Database ${method} ${path.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return method === "GET" ? res.json() : null;
}

// Pages of 200: a menu is a few KB, and a thousand of them at once is more than a request should carry.
let offset = 0;
let seen = 0;
let found = 0;
let changed = 0;
let failed = 0;
const examples = [];
for (;;) {
  const rows = await rest(`food_places?select=id,name,menu_items,vegan_options_status,vegan_options&menu_items_status=eq.ok&order=id&limit=200&offset=${offset}`);
  if (!rows.length) break;
  for (const row of rows) {
    seen += 1;
    const vegan = findVeganOptions(row.menu_items);
    if (vegan.status === "found") {
      found += 1;
      if (examples.length < 8) examples.push(`${row.name}: ${vegan.items.slice(0, 3).map((i) => i.name).join(", ")}`);
    }
    // jsonb hands keys back in its own order, so compare values, not key order.
    const shape = (items) => JSON.stringify((items ?? []).map((i) => [i.name, i.section ?? null, i.price ?? null, i.note ?? null]));
    const same = row.vegan_options_status === vegan.status && shape(row.vegan_options?.items) === shape(vegan.items);
    if (same) continue;
    changed += 1;
    if (!dry) {
      try {
        await rest(`food_places?id=eq.${row.id}`, { method: "PATCH", body: { vegan_options: { items: vegan.items }, vegan_options_at: new Date().toISOString(), vegan_options_status: vegan.status } });
      } catch (e) {
        failed += 1;
        console.log(`  ${row.name}: not saved (${String(e.message ?? e).slice(0, 120)})`);
      }
    }
  }
  offset += rows.length;
}
console.log(`${dry ? "Would update" : "Updated"} ${changed} of ${seen} saved menus; ${found} have vegan options.${failed ? ` ${failed} could not be saved.` : ""}`);
for (const e of examples) console.log("  " + e);
