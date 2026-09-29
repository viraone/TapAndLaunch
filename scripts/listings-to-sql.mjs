// Prints SQL that loads StageTime open-mic records into public.listings for one app.
// Usage: node scripts/listings-to-sql.mjs <app-id> < open-mics.json
// Needs Node 22.18 or later, which can import the TypeScript file directly.
import { readFileSync } from "node:fs";
import { listingsToSql } from "../src/lib/listings/to-sql.ts";

const [appId] = process.argv.slice(2);
if (!appId) {
  console.error("Usage: node scripts/listings-to-sql.mjs <app-id> < open-mics.json");
  process.exit(1);
}
process.stdout.write(listingsToSql(JSON.parse(readFileSync(0, "utf8")), appId));
