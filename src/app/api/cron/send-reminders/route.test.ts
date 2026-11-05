import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: 0,
  summary: { apps: 1, sent: 2, failed: 0, skipped: 1, limited: false },
}));

vi.mock("@/lib/reminders/sender", () => ({
  runReminderSender: async () => {
    state.calls += 1;
    return state.summary;
  },
}));

import { GET } from "./route";

const originalSecret = process.env.CRON_SECRET;

function get(authorization?: string) {
  return GET(
    new Request("http://localhost/api/cron/send-reminders", {
      headers: authorization === undefined ? undefined : { authorization },
    })
  );
}

beforeEach(() => {
  state.calls = 0;
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("GET /api/cron/send-reminders", () => {
  it("503s without doing anything when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;

    const response = await get("Bearer anything");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Not configured" });
    expect(state.calls).toBe(0);
  });

  it.each([
    ["a missing header", undefined],
    ["an empty header", ""],
    ["a header without Bearer", "secret-value"],
    ["a same-length wrong secret", "Bearer secret-valuX"],
    ["a different-length secret", "Bearer short"],
  ])("401s on %s", async (_label, authorization) => {
    process.env.CRON_SECRET = "secret-value";

    const response = await get(authorization);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(state.calls).toBe(0);
  });

  it("runs the sender and returns its summary with the right header", async () => {
    process.env.CRON_SECRET = "secret-value";

    const response = await get("Bearer secret-value");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, ...state.summary });
    expect(state.calls).toBe(1);
  });
});
