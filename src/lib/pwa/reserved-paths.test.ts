import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isReservedPagePath, RESERVED_PAGE_PATHS } from "@/lib/pwa/reserved-paths";

describe("reserved page paths", () => {
  it("lists every segment the published-app route tree answers itself", () => {
    const dir = join(process.cwd(), "src/app/published-apps/[appSlug]");
    const own = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("[") && !e.name.startsWith("("))
      .map((e) => e.name);
    expect(own.length).toBeGreaterThan(0);
    for (const name of own) expect(RESERVED_PAGE_PATHS.has(name), name).toBe(true);
  });

  it("refuses them and allows ordinary paths", () => {
    expect(isReservedPagePath("submit")).toBe(true);
    expect(isReservedPagePath("gas")).toBe(true);
    expect(isReservedPagePath("add-mic")).toBe(false);
    expect(isReservedPagePath("submissions")).toBe(false);
  });
});
