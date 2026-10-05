import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES } from "@/lib/builder/block-defaults";
import { STARTER_TEMPLATES, buildStarter } from "@/lib/apps/templates";

/** Block types are listed in three places (TypeScript, the save route, the database rule). These keep them in step. */
describe("block types stay in sync", () => {
  it("the latest database rule allows every block type the builder knows", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const latest = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .filter((sql) => sql.includes("blocks_type_check"))
      .at(-1) as string;
    const allowed = [...latest.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    for (const type of BLOCK_TYPES) expect(allowed, type).toContain(type);
  });

  it("the block save route uses the shared list, not its own copy", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/apps/[appId]/pages/[pageId]/blocks/route.ts"), "utf8");
    expect(route).toContain("z.enum(BLOCK_TYPES");
  });

  it("every block in every template is a known block type", () => {
    for (const t of STARTER_TEMPLATES) {
      for (const page of buildStarter(t.id, "x").pages) for (const b of page.blocks) expect(BLOCK_TYPES, `${t.id}: ${b.type}`).toContain(b.type);
    }
  });
});
