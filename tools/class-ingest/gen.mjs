// Builds the FitnessNav preview page from the reader's results (out/*.json + studios.json).
import fs from "node:fs";
import { classTypeOf, isOnlineClass } from "./classify.mjs";
const dir = process.argv[2] ?? ".";
const studios = JSON.parse(fs.readFileSync(`${dir}/studios.json`, "utf8"));
const results = fs.readdirSync(`${dir}/out`).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(`${dir}/out/${f}`, "utf8")));

const classes = [];
const studioRows = [];
for (const s of studios) {
  const r = results.find((x) => x.name === s.name);
  studioRows.push({ name: s.name, kind: s.kind, km: s.km, site: s.site, status: r?.status ?? "not_run", scheduleUrl: r?.scheduleUrl ?? null, count: r?.classes?.length ?? 0, platform: r?.platform ?? null });
  for (const c of r?.classes ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date ?? "")) continue;
    classes.push({ date: c.date, start: c.start, end: c.end, name: c.name, instructor: c.instructor, spots: c.spots, type: classTypeOf(c.name, s.kind), online: isOnlineClass(c.name), studio: s.name, km: s.km, book: r.scheduleUrl ?? s.site });
  }
}
classes.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
const now = new Date();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now); // YYYY-MM-DD
const readOn = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const data = { readOn, area: "Fremont, Seattle", today, classes, studios: studioRows };
const tpl = fs.readFileSync(`${dir}/template.html`, "utf8");
fs.writeFileSync(`${dir}/fitnessnav.html`, tpl.replace("/*__DATA__*/null", JSON.stringify(data)));
const byType = {};
for (const c of classes) byType[c.type] = (byType[c.type] ?? 0) + 1;
console.log(classes.length, "dated classes;", JSON.stringify(byType), "| studios read:", studioRows.filter((s) => s.status === "ok").length, "of", studioRows.length);
