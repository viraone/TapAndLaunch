import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: null as unknown,
  dbTouched: false,
  token: null as unknown,
  connection: null as unknown,
  gmail: null as unknown,
  showProject: null as unknown,
  showContacts: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/automation/auth", () => ({
  automationCaller: async () => state.caller,
  bearerToken: () => "show-token",
}));
vi.mock("@/lib/openmic/push-server", () => ({
  showProjectFor: async () => state.showProject,
  showClient: () => ({ rpc: async () => ({ data: [], error: null }) }),
}));
vi.mock("@/lib/automation/show-contacts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/automation/show-contacts")>();
  return {
    ...actual,
    listShowContacts: async () => state.showContacts,
  };
});
vi.mock("@/lib/integrations/google/connection", () => ({
  getAccessToken: async () => {
    state.dbTouched = true;
    return state.token;
  },
  getConnectionStatus: async () => {
    state.dbTouched = true;
    return state.connection;
  },
}));
vi.mock("@/lib/integrations/google/people", () => ({
  listContacts: async () => {
    state.dbTouched = true;
    return state.gmail;
  },
}));

import { GET } from "./route";

const SHOW = [
  { name: "Show Person", email: "show@example.com" },
  { name: "Comic", email: "comic@example.com" },
];
const GMAIL = [
  { name: "Gmail Person", email: "gmail@example.com" },
  { name: "Comic from Gmail", email: "COMIC@example.com" },
];

function get() {
  return GET(
    new Request("http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation/contacts", {
      headers: { authorization: "Bearer show-token" },
    }),
    { params: Promise.resolve({ appSlug: "stagetimepnw" }) }
  );
}

function callerOk() {
  return {
    ok: true,
    appId: "app-1",
    appName: "StageTime",
    email: "host@example.com",
    userId: "user-1",
  };
}

function ready() {
  state.caller = callerOk();
  state.token = { ok: true, accessToken: "google-token", email: "owner@gmail.com" };
  state.connection = { canReadContacts: true, canReadOtherContacts: false };
  state.gmail = { ok: true, contacts: GMAIL };
  state.showProject = { url: "https://show.example", anonKey: "anon-key" };
  state.showContacts = SHOW;
}

beforeEach(() => {
  state.caller = null;
  state.dbTouched = false;
  state.token = null;
  state.connection = null;
  state.gmail = null;
  state.showProject = null;
  state.showContacts = null;
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

  it("merges show comics and Gmail contacts when both can be read", async () => {
    ready();

    const response = await get();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contacts: [
        { name: "Comic", email: "comic@example.com" },
        { name: "Gmail Person", email: "gmail@example.com" },
        { name: "Show Person", email: "show@example.com" },
      ],
      sources: { show: 2, gmail: 2 },
    });
  });

  it("returns the show's comics when Gmail is not connected", async () => {
    ready();
    state.token = { ok: false, reason: "not_connected" };

    const response = await get();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contacts: [
        { name: "Comic", email: "comic@example.com" },
        { name: "Show Person", email: "show@example.com" },
      ],
      sources: { show: 2, gmail: null },
    });
  });

  it("returns the show's comics when Gmail lacks the contacts permission", async () => {
    ready();
    state.connection = { canReadContacts: false, canReadOtherContacts: false };

    const response = await get();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { sources: unknown };
    expect(body.sources).toEqual({ show: 2, gmail: null });
  });

  it("returns Gmail contacts when the show's RPC fails", async () => {
    ready();
    state.showContacts = null;

    const response = await get();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contacts: [
        { name: "Comic from Gmail", email: "comic@example.com" },
        { name: "Gmail Person", email: "gmail@example.com" },
      ],
      sources: { show: null, gmail: 2 },
    });
  });

  it("gives today's Gmail error only when both sources fail", async () => {
    ready();
    state.showContacts = null;
    state.token = { ok: false, reason: "not_connected" };

    const response = await get();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Connect Gmail first." });
  });

  it("gives today's Gmail 502 when Google and the show both fail", async () => {
    ready();
    state.showContacts = null;
    state.gmail = { ok: false, reason: "unavailable" };

    const response = await get();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Couldn't load your contacts. Try again.",
    });
  });
});
