import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const calls: Array<[string, ...unknown[]]> = [];
  const state: { result: { data: unknown; error: unknown } } = { result: { data: [], error: null } };
  const query = {
    select: (...args: unknown[]) => { calls.push(["select", ...args]); return query; },
    eq: (...args: unknown[]) => { calls.push(["eq", ...args]); return query; },
    order: (...args: unknown[]) => { calls.push(["order", ...args]); return Promise.resolve(state.result); },
  };
  const client = { from: (table: string) => { calls.push(["from", table]); return query; } };
  return { calls, state, client };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

import { getActiveListings } from "@/lib/pwa/listings";

describe("getActiveListings", () => {
  beforeEach(() => {
    fake.calls.length = 0;
    fake.state.result = { data: [], error: null };
  });

  it("asks for the app's active listings, ordered by slug", async () => {
    await getActiveListings("app-1");
    expect(fake.calls).toEqual([
      ["from", "listings"],
      ["select", "slug, record"],
      ["eq", "app_id", "app-1"],
      ["eq", "is_active", true],
      ["order", "slug", { ascending: true }],
    ]);
  });

  it("returns the rows it gets", async () => {
    fake.state.result = { data: [{ slug: "a", record: { id: "A" } }], error: null };
    expect(await getActiveListings("app-1")).toEqual([{ slug: "a", record: { id: "A" } }]);
  });

  it("returns an empty list when there is no data", async () => {
    fake.state.result = { data: null, error: null };
    expect(await getActiveListings("app-1")).toEqual([]);
  });

  it("throws the database error", async () => {
    const error = new Error("boom");
    fake.state.result = { data: null, error };
    await expect(getActiveListings("app-1")).rejects.toBe(error);
  });
});
