import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: null as unknown,
  dbTouched: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/automation/auth", () => ({
  automationCaller: async () => state.caller,
}));
vi.mock("@/lib/integrations/google/connection", () => ({
  getAccessToken: async () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
  getConnectionStatus: async () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
}));
vi.mock("@/lib/integrations/google/people", () => ({
  listContacts: async () => {
    state.dbTouched = true;
    throw new Error("Google must not be called");
  },
}));

import { GET } from "./route";

function get() {
  return GET(
    new Request("http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation/contacts", {
      headers: { authorization: "Bearer show-token" },
    }),
    { params: Promise.resolve({ appSlug: "stagetimepnw" }) }
  );
}

beforeEach(() => {
  state.dbTouched = false;
});

describe("GET automation contacts", () => {
  it("401s without a show session, before reading anything", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Sign in again" }, { status: 401 }),
    };

    const response = await get();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in again" });
    expect(state.dbTouched).toBe(false);
  });

  it("403s for someone who is not on the Automation list", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Not for you" }, { status: 403 }),
    };

    const response = await get();

    expect(response.status).toBe(403);
    expect(state.dbTouched).toBe(false);
  });
});
