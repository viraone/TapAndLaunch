import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: null as unknown,
  dbTouched: false,
  slug: "",
  url: "",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/automation/auth", () => ({
  automationCaller: async (appSlug: string, request: Request) => {
    state.slug = appSlug;
    state.url = request.url;
    return state.caller;
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
}));
vi.mock("@/lib/integrations/google/connection", () => ({
  getConnectionStatus: async () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
}));
vi.mock("@/lib/automation/config", () => ({
  openMicConfigFor: async () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
  contactListUrlFor: async () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
}));

import { GET } from "./route";

function get() {
  return GET(
    new Request("http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation", {
      headers: { authorization: "Bearer show-token" },
    }),
    { params: Promise.resolve({ appSlug: "stagetimepnw" }) }
  );
}

beforeEach(() => {
  state.dbTouched = false;
  state.slug = "";
  state.url = "";
});

describe("GET automation state", () => {
  it("401s when the show session is missing, before any database read", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Sign in again" }, { status: 401 }),
    };

    const response = await get();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in again" });
    expect(state.dbTouched).toBe(false);
    expect(state.slug).toBe("stagetimepnw");
  });

  it("403s when the caller is not on the Automation list, before any database read", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Not for you" }, { status: 403 }),
    };

    const response = await get();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Not for you" });
    expect(state.dbTouched).toBe(false);
  });
});
