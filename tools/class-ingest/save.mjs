// Saves the morning run's results (out/*.json) to the LIVE database for the FitnessNav app: one fitness_studios row per
// studio (status, schedule page, class count) and, for each studio read successfully today, its classes from today on
// (replacing what was saved before). A studio that couldn't be read today keeps its earlier classes.
// Needs .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FITNESSNAV_APP_ID. Usage: node save.mjs [out-dir]
import fs from "node:fs";
import { classTypeOf, isOnlineClass } from "./classify.mjs";

const env = {};
if (fs.existsSync(".env")) for (const l of fs.readFileSync(".env", "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY, FITNESSNAV_APP_ID: APP } = env;
if (!URL_ || !KEY || !APP) { console.log("save.mjs: no .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FITNESSNAV_APP_ID; nothing saved."); process.exit(0); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

const outDir = process.argv[2] ?? "out";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const studios = JSON.parse(fs.readFileSync("studios.json", "utf8"));
const results = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(`${outDir}/${f}`, "utf8"))) : [];
const now = new Date().toISOString();
let saved = 0;
for (const s of studios) {
  const r = results.find((x) => x.name === s.name);
  if (!r) continue; // not part of this run (e.g. a one-studio test)
  const ok = r.status === "ok";
  const classes = ok ? r.classes.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date ?? "") && c.date >= today && /^\d{2}:\d{2}$/.test(c.start ?? "")) : [];
  const [row] = await rest("fitness_studios?on_conflict=app_id,name", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      app_id: APP, name: s.name, google_place_id: s.id ?? null, kind: s.kind, address: s.address ?? null, neighborhood: s.neighborhood ?? null,
      latitude: s.lat ?? null, longitude: s.lng ?? null, website: s.site ?? null, schedule_url: ok ? r.scheduleUrl : null,
      read_status: r.status, read_at: now, class_count: classes.length,
    }],
  });
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
console.log(`Saved ${saved} classes for ${results.filter((r) => r.status === "ok").length} studios to the live database.`);
