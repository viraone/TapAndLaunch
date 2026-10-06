// Saves the morning run's results (out/*.json) to the LIVE database for the FitnessNav app: one fitness_studios row per
// studio (status, schedule page, class count) and, for each studio read successfully today, its classes from today on
// (replacing what was saved before). A studio that couldn't be read today keeps its earlier classes.
// Needs .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FITNESSNAV_APP_ID. Usage: node save.mjs [out-dir]
import fs from "node:fs";
import { classTypeOf, isNotAGroupClass, isOnlineClass } from "./classify.mjs";

const env = {};
if (fs.existsSync(".env")) for (const l of fs.readFileSync(".env", "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY, FITNESSNAV_APP_ID: APP } = env;
if (!URL_ || !KEY || !APP) { console.log("save.mjs: no .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FITNESSNAV_APP_ID; nothing saved."); process.exit(0); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
// FN_DRY_RUN=1: read the database but change nothing (prints what would be written).
const DRY = !!process.env.FN_DRY_RUN;
async function rest(path, { method = "GET", body, prefer } = {}) {
  if (DRY && method !== "GET") { console.log(`  (dry run) ${method} ${path.split("?")[0]}${body ? ` x${Array.isArray(body) ? body.length : 1}` : ""}`); return null; }
  const res = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const text = await res.text(); // deletes and return=minimal writes answer with no body
  return text ? JSON.parse(text) : null;
}

const outDir = process.argv[2] ?? "out";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const studios = JSON.parse(fs.readFileSync("studios.json", "utf8"));
const results = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(`${outDir}/${f}`, "utf8"))) : [];
const now = new Date().toISOString();
const plusDays = (d, n) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
const weekEnd = plusDays(today, 7);
const FRESH_DAYS = 3;

/**
 * A read that came back with far fewer classes for the coming week than the site already shows (a widget that opened on
 * the wrong week, a home page instead of the schedule page) must not replace good data. What is saved is kept until it
 * is a few days old; then whatever today's read found is taken. Returns why to keep, or null to save as usual.
 */
async function worseThanSaved(name, classes) {
  const rows = await rest(`fitness_studios?app_id=eq.${APP}&name=eq.${encodeURIComponent(name)}&select=id`);
  const id = rows?.[0]?.id;
  if (!id) return null;
  const saved = await rest(`fitness_classes?studio_id=eq.${id}&class_date=gte.${today}&class_date=lt.${weekEnd}&select=class_date,read_at`);
  if (!saved || saved.length < 5) return null;
  const newest = saved.map((c) => c.read_at).sort().at(-1);
  if (Date.now() - new Date(newest).getTime() > FRESH_DAYS * 86400000) return null;
  const mine = classes.filter((c) => c.date >= today && c.date < weekEnd).length;
  if (mine >= saved.length / 2) return null;
  return `the site has ${saved.length} classes for the coming week, today's read found only ${mine}`;
}

let saved = 0;
let kept = 0;
for (const s of studios) {
  const r = results.find((x) => x.name === s.name);
  if (!r) continue; // not part of this run (e.g. a one-studio test)
  const ok = r.status === "ok";
  const classes = ok ? r.classes.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date ?? "") && c.date >= today && /^\d{2}:\d{2}$/.test(c.start ?? "") && !isNotAGroupClass(c.name, c.start, c.end)) : [];
  if (ok) {
    const why = await worseThanSaved(s.name, classes);
    if (why) { console.log(`  ${s.name}: kept what the site has (${why}).`); kept += 1; continue; }
  }
  const [row] = (await rest("fitness_studios?on_conflict=app_id,name", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      app_id: APP, name: s.name, google_place_id: s.id ?? null, kind: s.kind, address: s.address ?? null, neighborhood: s.neighborhood ?? null,
      latitude: s.lat ?? null, longitude: s.lng ?? null, website: s.site ?? null, schedule_url: ok ? r.scheduleUrl : null,
      read_status: r.status, read_at: now, class_count: classes.length,
    }],
  })) ?? [{ id: "dry-run" }];
  if (!ok) continue;
  await rest(`fitness_classes?studio_id=eq.${row.id}&class_date=gte.${today}`, { method: "DELETE", prefer: "return=minimal" });
  if (classes.length) {
    await rest("fitness_classes", {
      method: "POST",
      prefer: "return=minimal",
      body: classes.map((c) => ({
        app_id: APP, studio_id: row.id, class_date: c.date, start_time: c.start, end_time: /^\d{2}:\d{2}$/.test(c.end ?? "") ? c.end : null,
        name: String(c.name).slice(0, 160), instructor: c.instructor ? String(c.instructor).slice(0, 80) : null, spots: c.spots ? String(c.spots).slice(0, 40) : null,
        class_type: classTypeOf(c.name, s.kind), online: isOnlineClass(c.name), read_at: now,
      })),
    });
  }
  saved += classes.length;
}
// Classes from past days are no longer shown; keep the table small.
await rest(`fitness_classes?app_id=eq.${APP}&class_date=lt.${today}`, { method: "DELETE", prefer: "return=minimal" });
console.log(`Saved ${saved} classes for ${results.filter((r) => r.status === "ok").length - kept} studios to the live database${kept ? `; kept the site's classes for ${kept}` : ""}.`);
