import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  theme: null as Record<string, unknown> | null,
  readError: null as { message: string } | null,
  reads: 0,
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            db.reads += 1;
            return db.readError ? { data: null, error: db.readError } : { data: { theme: db.theme }, error: null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        db.updates.push(payload);
        return {
          eq: () => ({
            select: () => ({ single: async () => ({ data: { id: "app-1", ...payload }, error: null }) }),
          }),
        };
      },
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/org", () => ({ isAppAdmin: vi.fn() }));
vi.mock("@/lib/domains/vercel", () => ({ removeDomain: vi.fn() }));
vi.mock("@/lib/domains/companion", () => ({ companionOptions: vi.fn() }));

import { PATCH } from "./route";

function patch(body: unknown) {
  return PATCH(new Request("http://test/api/apps/app-1", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ appId: "app-1" }),
  });
}

describe("PATCH /api/apps/[appId]", () => {
  beforeEach(() => {
    db.theme = null;
    db.readError = null;
    db.reads = 0;
    db.updates = [];
  });

  it("keeps server-managed theme keys when the settings dialog saves", async () => {
    const headerAction = { label: "Profile", icon: "profile", page_path: "profile" };
    db.theme = {
      primary_color: "#ffffff",
      background_color: "#111111",
      header_action: headerAction,
      home_redirect: "https://example.com/party",
      home_redirect_until: "2026-11-02T00:00:00-08:00",
    };

    const response = await patch({ theme: { primary_color: "#000000" } });

    expect(response.status).toBe(200);
    expect(db.updates).toEqual([
      {
        theme: {
          primary_color: "#000000",
          header_action: headerAction,
          home_redirect: "https://example.com/party",
          home_redirect_until: "2026-11-02T00:00:00-08:00",
        },
      },
    ]);
  });

  it("does not let a client set or change a server-managed key", async () => {
    db.theme = { home_redirect: "https://example.com/party" };

    await patch({
      theme: {
        primary_color: "#000000",
        home_redirect: "https://evil.example",
        header_action: { label: "x", icon: "x", page_path: "x" },
      },
    });

    expect(db.updates[0].theme).toEqual({ primary_color: "#000000", home_redirect: "https://example.com/party" });
  });

  it("writes nothing when the current theme can't be read", async () => {
    db.readError = { message: "read failed" };

    const response = await patch({ theme: { primary_color: "#000000" } });

    expect(response.status).toBe(400);
    expect(db.updates).toEqual([]);
  });

  it("does not read or write the theme on a manifest-only save", async () => {
    const response = await patch({ manifest: { icon_url: "https://example.com/icon.png" } });

    expect(response.status).toBe(200);
    expect(db.reads).toBe(0);
    expect(db.updates).toEqual([{ manifest: { icon_url: "https://example.com/icon.png" } }]);
  });
});
