import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: null as unknown,
  serviceCalls: 0,
}));

// The service functions are the only code that touches the service-role automation tables; a refusal must not reach
// them, so every refusal test asserts this counter stayed at zero.
vi.mock("@/lib/automation/dashboard", () => ({
  schedulingCaller: async () => state.caller,
  loadSchedulingContacts: async () => {
    state.serviceCalls += 1;
    return Response.json({ contacts: [] });
  },
}));

import { GET } from "./route";

const context = {
  params: Promise.resolve({ appId: "11111111-1111-1111-1111-111111111111" }),
};

function refusal(status: number, error: string) {
  return { ok: false, response: Response.json({ error }, { status }) };
}

function get() {
  return GET(
    new Request("http://test/api/apps/app/automation/contacts"),
    context
  );
}

beforeEach(() => {
  state.serviceCalls = 0;
});

describe("GET dashboard automation contacts", () => {
  it("401s when signed out without reading contacts", async () => {
    state.caller = refusal(401, "Not authenticated");

    const response = await get();

    expect(response.status).toBe(401);
    expect(state.serviceCalls).toBe(0);
  });

  it("403s when the user is not an editor", async () => {
    state.caller = refusal(403, "Not authorized");

    const response = await get();

    expect(response.status).toBe(403);
    expect(state.serviceCalls).toBe(0);
  });

  it("400s when Scheduling is not turned on", async () => {
    state.caller = refusal(
      400,
      "Scheduling isn't turned on for this app yet."
    );

    const response = await get();

    expect(response.status).toBe(400);
    expect(state.serviceCalls).toBe(0);
  });

  it("reads the contacts for an editor", async () => {
    state.caller = {
      ok: true,
      supabase: {},
      user: { id: "user_1", email: "owner@example.com" },
      appName: "Jay's Cleaning",
      timeZone: "America/Los_Angeles",
    };

    const response = await get();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ contacts: [] });
    expect(state.serviceCalls).toBe(1);
  });
});
