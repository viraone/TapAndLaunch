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
vi.mock("@/lib/automation/config", () => ({
  openMicConfigFor: async () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
}));
vi.mock("@/lib/integrations/google/connection", () => ({
  getAccessToken: async () => {
    state.dbTouched = true;
    throw new Error("the database must not be reached");
  },
}));
vi.mock("@/lib/reminders/gmail", () => ({
  sendViaGmail: async () => {
    state.dbTouched = true;
    throw new Error("Gmail must not be called");
  },
}));

import { POST } from "./route";

function post(payload: unknown = { id: "11111111-1111-1111-1111-111111111111" }) {
  return POST(
    new Request(
      "http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation/reminders/test",
      {
        method: "POST",
        headers: { authorization: "Bearer show-token", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    ),
    { params: Promise.resolve({ appSlug: "stagetimepnw" }) }
  );
}

beforeEach(() => {
  state.dbTouched = false;
});

describe("POST automation reminder test", () => {
  it("401s without a show session, before anything is read or sent", async () => {
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

  it("400s on a missing reminder id before touching the database", async () => {
    state.caller = {
      ok: true,
      appId: "app_1",
      appName: "StageTime",
      email: "host@example.com",
      userId: "user_1",
    };

    const response = await post({ to: "attacker@example.com" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid input" });
    expect(state.dbTouched).toBe(false);
  });
});
