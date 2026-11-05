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

import { DELETE, PUT } from "./route";

const context = { params: Promise.resolve({ appSlug: "stagetimepnw" }) };

const body = {
  id: null,
  name: "Thursday reminder",
  schedule_kind: "weekly",
  weekday: 4,
  once_date: null,
  send_time: "19:00",
  subject: "See you tomorrow",
  body: "Hey {first_name}, see you tomorrow at {show_name}.",
  recipients: [{ name: "Alex Morgan", email: "alex@example.com" }],
};

function put(payload: unknown = body) {
  return PUT(
    new Request("http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation/reminders", {
      method: "PUT",
      headers: { authorization: "Bearer show-token", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    context
  );
}

function remove() {
  return DELETE(
    new Request(
      "http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation/reminders?id=11111111-1111-1111-1111-111111111111",
      { method: "DELETE", headers: { authorization: "Bearer show-token" } }
    ),
    context
  );
}

beforeEach(() => {
  state.dbTouched = false;
});

describe("PUT automation reminder", () => {
  it("401s without a show session, before any database write", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Sign in again" }, { status: 401 }),
    };

    const response = await put();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in again" });
    expect(state.dbTouched).toBe(false);
  });

  it("403s for someone who is not on the Automation list", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Not for you" }, { status: 403 }),
    };

    const response = await put();

    expect(response.status).toBe(403);
    expect(state.dbTouched).toBe(false);
  });

  it("400s on an unreadable reminder before touching the database", async () => {
    state.caller = {
      ok: true,
      appId: "app_1",
      appName: "StageTime",
      email: "host@example.com",
      userId: "user_1",
    };

    const response = await put({});

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBeTruthy();
    expect(state.dbTouched).toBe(false);
  });
});

describe("DELETE automation reminder", () => {
  it("401s without a show session, before any database delete", async () => {
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
