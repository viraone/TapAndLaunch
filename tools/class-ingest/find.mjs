#!/usr/bin/env node
// Finds candidate gyms and studios for FitnessNav in a neighborhood: Google Places text search, one query per kind of
// class, inside a box drawn around the neighborhood. Writes entries in studios.json's shape (not yet in the list) to a
// JSON file for a test read; nothing goes live from here.
//
// Usage: node find.mjs <out.json> "<Neighborhood>=<south>,<west>,<north>,<east>" [...]
// The key: GOOGLE_MAPS_API_KEY from the environment or the repo's .env.local (Places API (New), Text Search, Pro SKU).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [out, ...boxes] = process.argv.slice(2);
if (!out || !boxes.length) {
  console.error('Usage: node find.mjs <out.json> "<Neighborhood>=<south>,<west>,<north>,<east>" [...]');
  process.exit(1);
}
function key() {
  if (process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY;
  const file = join(here, "..", "..", ".env.local");
  if (!existsSync(file)) throw new Error("No GOOGLE_MAPS_API_KEY in the environment or .env.local");
  const m = /^GOOGLE_MAPS_API_KEY=(.*)$/m.exec(readFileSync(file, "utf8"));
  if (!m) throw new Error("GOOGLE_MAPS_API_KEY not in .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const KEY = key();
// Where the app's area is centred (Fremont); `km` in studios.json is the distance from here.
const CENTER = { lat: 47.6512, lng: -122.3505 };
const kmFrom = (lat, lng) => {
  const R = 6371, dLat = ((lat - CENTER.lat) * Math.PI) / 180, dLng = ((lng - CENTER.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((CENTER.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 100) / 100;
};
// One search per kind of class the page offers; the kind is a first guess, the class names decide later (classify.mjs).
const QUERIES = [
  ["pilates", "pilates studio"],
  ["pilates", "reformer pilates barre studio"],
  ["yoga", "yoga studio"],
  ["yoga", "hot yoga meditation sound bath"],
  ["spin", "indoor cycling spin studio"],
  ["lifting", "gym fitness classes strength training"],
  ["lifting", "crossfit functional fitness"],
  ["lifting", "hiit bootcamp boxing group fitness"],
  ["climbing", "climbing gym"],
];
// Not studios: physical therapy, personal-training-only, apparel, big-box with no class schedule we can read.
const NOT_A_STUDIO = /physical therapy|chiropract|massage|personal training only|apparel|supplement|24 hour fitness|planet fitness|la fitness|ymca|anytime fitness/i;

const known = new Map(JSON.parse(readFileSync(join(here, "studios.json"), "utf8")).map((s) => [s.id, s.name]));
const found = new Map();
let calls = 0;
for (const box of boxes) {
  const [hood, nums] = box.split("=");
  const [south, west, north, east] = nums.split(",").map(Number);
  for (const [kind, text] of QUERIES) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.location,places.types,places.primaryType,places.businessStatus" },
      body: JSON.stringify({ textQuery: text, locationRestriction: { rectangle: { low: { latitude: south, longitude: west }, high: { latitude: north, longitude: east } } }, pageSize: 20, languageCode: "en" }),
    });
    calls += 1;
    if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { places = [] } = await res.json();
    for (const p of places) {
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      const name = p.displayName?.text ?? "";
      if (NOT_A_STUDIO.test(name) || NOT_A_STUDIO.test((p.types ?? []).join(" "))) continue;
      if (found.has(p.id) || known.has(p.id)) continue;
      found.set(p.id, {
        kind,
        name,
        site: p.websiteUri ?? null,
        km: kmFrom(p.location.latitude, p.location.longitude),
        address: p.formattedAddress,
        neighborhood: hood,
        id: p.id,
        lat: p.location.latitude,
        lng: p.location.longitude,
        types: (p.types ?? []).filter((t) => /gym|fitness|yoga|pilates|sports|climb|health/i.test(t)).slice(0, 4),
      });
    }
  }
}
const list = [...found.values()].sort((a, b) => a.neighborhood.localeCompare(b.neighborhood) || a.name.localeCompare(b.name));
writeFileSync(out, JSON.stringify(list, null, 2) + "\n");
console.log(`${list.length} candidates (${calls} Places calls; ${known.size} already in the list) -> ${out}`);
for (const s of list) console.log(`${s.neighborhood.padEnd(18)} ${s.kind.padEnd(8)} ${s.name.slice(0, 42).padEnd(42)} ${s.site ? s.site.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40) : "(no website)"}`);
