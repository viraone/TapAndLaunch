import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: null as unknown,
  serviceCalls: 0,
}));

// The service functions are the only code that touches the service-role automation tables; a refusal must not reach
// them, so every refusal test asserts this counter stayed at zero.
vi.mock("@/lib/automation/dashboard", () => ({
  schedulingCaller: async () => state.caller,
  saveSchedulingReminder: async () => {
    state.serviceCalls += 1;
    return Response.json({ reminder: {} });
  },
  deleteSchedulingReminder: async () => {
    state.serviceCalls += 1;
    return Response.json({ ok: true });
  },
}));

import { DELETE, PUT } from "./route";

const context = {
  params: Promise.resolve({ appId: "11111111-1111-1111-1111-111111111111" }),
};

const body = {
  id: null,
  name: "New message",
  schedule_kind: "once",
  weekday: null,
  once_date: "2026-12-24",
  send_time: "09:00",
  subject: "A note from {business}",
  body: "Hi {first_name}, thank you.",
  recipients: [{ name: "Alex Morgan", email: "alex@example.com" }],
};

function refusal(status: number, error: string) {
  return { ok: false, response: Response.json({ error }, { status }) };
}

function put() {
  return PUT(
    new Request("http://test/api/apps/app/automation/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    context
  );
}

function remove() {
  return DELETE(
    new Request(
      "http://test/api/apps/app/automation/reminders?id=22222222-2222-2222-2222-222222222222",
      { method: "DELETE" }
    ),
    context
  );
}

beforeEach(() => {
  state.serviceCalls = 0;
});

describe("PUT dashboard automation reminder", () => {
  it("401s when signed out without saving", async () => {
    state.caller = refusal(401, "Not authenticated");

    const response = await put();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
    expect(state.serviceCalls).toBe(0);
  });

  it("403s when the user is not an editor", async () => {
    state.caller = refusal(403, "Not authorized");

    const response = await put();

    expect(response.status).toBe(403);
    expect(state.serviceCalls).toBe(0);
  });

  it("400s when Scheduling is not turned on", async () => {
    state.caller = refusal(
      400,
      "Scheduling isn't turned on for this app yet."
    );

    const response = await put();

    expect(response.status).toBe(400);
    expect(state.serviceCalls).toBe(0);
  });

  it("saves for an editor", async () => {
    state.caller = {
      ok: true,
      supabase: {},
      user: { id: "user_1", email: "owner@example.com" },
      appName: "Jay's Cleaning",
      timeZone: "America/Los_Angeles",
    };

    const response = await put();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reminder: {} });
    expect(state.serviceCalls).toBe(1);
  });
});

describe("DELETE dashboard automation reminder", () => {
  it("401s when signed out without deleting", async () => {
    state.caller = refusal(401, "Not authenticated");

    const response = await remove();

    expect(response.status).toBe(401);
    expect(state.serviceCalls).toBe(0);
  });

  it("403s when the user is not an editor", async () => {
    state.caller = refusal(403, "Not authorized");

    const response = await remove();

    expect(response.status).toBe(403);
    expect(state.serviceCalls).toBe(0);
  });

  it("400s when Scheduling is not turned on", async () => {
    state.caller = refusal(
      400,
      "Scheduling isn't turned on for this app yet."
    );

    const response = await remove();

    expect(response.status).toBe(400);
    expect(state.serviceCalls).toBe(0);
  });

  it("deletes for an editor", async () => {
    state.caller = {
      ok: true,
      supabase: {},
      user: { id: "user_1", email: "owner@example.com" },
      appName: "Jay's Cleaning",
      timeZone: "America/Los_Angeles",
    };

    const response = await remove();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(state.serviceCalls).toBe(1);
  });
});
