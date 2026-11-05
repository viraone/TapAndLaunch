import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: null as unknown,
  serviceCalls: 0,
}));

// The service functions are the only code that touches the service-role automation tables; a refusal must not reach
// them, so every refusal test asserts this counter stayed at zero.
vi.mock("@/lib/automation/dashboard", () => ({
  schedulingCaller: async () => state.caller,
  sendSchedulingTestEmail: async () => {
    state.serviceCalls += 1;
    return Response.json({ ok: true, to: "owner@example.com" });
  },
}));

import { POST } from "./route";

const context = {
  params: Promise.resolve({ appId: "11111111-1111-1111-1111-111111111111" }),
};

function refusal(status: number, error: string) {
  return { ok: false, response: Response.json({ error }, { status }) };
}

function post() {
  return POST(
    new Request("http://test/api/apps/app/automation/reminders/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "22222222-2222-2222-2222-222222222222" }),
    }),
    context
  );
}

beforeEach(() => {
  state.serviceCalls = 0;
});

describe("POST dashboard automation test email", () => {
  it("401s when signed out without sending anything", async () => {
    state.caller = refusal(401, "Not authenticated");

    const response = await post();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
    expect(state.serviceCalls).toBe(0);
  });

  it("403s when the user is not an editor", async () => {
    state.caller = refusal(403, "Not authorized");

    const response = await post();

    expect(response.status).toBe(403);
    expect(state.serviceCalls).toBe(0);
  });

  it("400s when Scheduling is not turned on", async () => {
    state.caller = refusal(
      400,
      "Scheduling isn't turned on for this app yet."
    );

    const response = await post();

    expect(response.status).toBe(400);
    expect(state.serviceCalls).toBe(0);
  });

  it("sends the test for an editor", async () => {
    state.caller = {
      ok: true,
      supabase: {},
      user: { id: "user_1", email: "owner@example.com" },
      appName: "Jay's Cleaning",
      timeZone: "America/Los_Angeles",
    };

    const response = await post();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      to: "owner@example.com",
    });
    expect(state.serviceCalls).toBe(1);
  });
});
