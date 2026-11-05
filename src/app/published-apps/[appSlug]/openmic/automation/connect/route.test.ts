import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: null as unknown,
  dbTouched: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/automation/auth", () => ({
  automationCaller: async () => state.caller,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
}));
vi.mock("@/lib/integrations/google/connection", () => ({
  deleteConnection: async () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
}));

import { DELETE, POST } from "./route";

const context = { params: Promise.resolve({ appSlug: "stagetimepnw" }) };

function post() {
  return POST(
    new Request("http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation/connect", {
      method: "POST",
      headers: { authorization: "Bearer show-token" },
    }),
    context
  );
}

function remove() {
  return DELETE(
    new Request("http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation/connect", {
      method: "DELETE",
      headers: { authorization: "Bearer show-token" },
    }),
    context
  );
}

beforeEach(() => {
  state.dbTouched = false;
});

describe("POST connect", () => {
  it("401s without a show session, before any database write", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Sign in again" }, { status: 401 }),
    };

    const response = await post();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in again" });
    expect(state.dbTouched).toBe(false);
  });

  it("403s for someone who is not on the Automation list", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Not for you" }, { status: 403 }),
    };

    const response = await post();

    expect(response.status).toBe(403);
    expect(state.dbTouched).toBe(false);
  });

  it("503s before writing anything when Google is not configured on the server", async () => {
    const original = process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    state.caller = {
      ok: true,
      appId: "app_1",
      appName: "StageTime",
      email: "host@example.com",
      userId: "user_1",
    };

    try {
      const response = await post();

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "Connecting Gmail isn't available yet.",
      });
      expect(state.dbTouched).toBe(false);
    } finally {
      if (original !== undefined) process.env.GOOGLE_OAUTH_CLIENT_ID = original;
    }
  });
});

describe("DELETE connect", () => {
  it("401s without a show session, before any disconnect", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Sign in again" }, { status: 401 }),
    };

    const response = await remove();

    expect(response.status).toBe(401);
    expect(state.dbTouched).toBe(false);
  });

  it("403s for someone who is not on the Automation list", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Not for you" }, { status: 403 }),
    };

    const response = await remove();

    expect(response.status).toBe(403);
    expect(state.dbTouched).toBe(false);
  });
});
