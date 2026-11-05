import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: null as unknown,
  urlLooked: false,
  url: null as unknown,
  project: null as unknown,
  sheetArgs: null as unknown,
  contacts: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/automation/auth", () => ({
  automationCaller: async () => state.caller,
  bearerToken: () => "show-token",
}));
vi.mock("@/lib/automation/config", () => ({
  contactListUrlFor: async () => {
    state.urlLooked = true;
    return state.url;
  },
}));
vi.mock("@/lib/openmic/push-server", () => ({
  showProjectFor: async () => state.project,
}));
vi.mock("@/lib/automation/show-contacts", () => ({
  listSheetContacts: async (url: string, project: unknown, token: string) => {
    state.sheetArgs = { url, project, token };
    return state.contacts;
  },
}));

import { GET } from "./route";

const PROJECT = { url: "https://show.example", anonKey: "anon-key" };
const CONTACTS = [
  { name: "Zoe", email: "zoe@example.com" },
  { name: "Alex", email: "alex@example.com" },
];
const SHEET_URL = "https://show.example/functions/v1/contact-list";

function get() {
  return GET(
    new Request(
      "http://stagetimepnw.localhost/published-apps/stagetimepnw/openmic/automation/contact-list",
      { headers: { authorization: "Bearer show-token" } }
    ),
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

beforeEach(() => {
  state.caller = null;
  state.urlLooked = false;
  state.url = null;
  state.project = null;
  state.sheetArgs = null;
  state.contacts = null;
});

describe("GET automation contact list", () => {
  it("401s without a show session, before reading the block", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Sign in again" }, { status: 401 }),
    };

    const response = await get();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in again" });
    expect(state.urlLooked).toBe(false);
  });

  it("403s for someone who is not on the Automation list", async () => {
    state.caller = {
      ok: false,
      response: Response.json({ error: "Not for you" }, { status: 403 }),
    };

    const response = await get();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Not for you" });
    expect(state.urlLooked).toBe(false);
  });

  it("404s when the block has no usable contact list", async () => {
    state.caller = callerOk();

    const response = await get();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "This show has no contact list.",
    });
    expect(state.sheetArgs).toBeNull();
  });

  it("502s when the sheet cannot be read", async () => {
    state.caller = callerOk();
    state.url = SHEET_URL;
    state.project = PROJECT;
    state.contacts = null;

    const response = await get();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Couldn't load the contact list. Try again.",
    });
  });

  it("502s when the show project is missing", async () => {
    state.caller = callerOk();
    state.url = SHEET_URL;
    state.project = null;

    const response = await get();

    expect(response.status).toBe(502);
    expect(state.sheetArgs).toBeNull();
  });

  it("200s with the sheet's contacts, read with the caller's token", async () => {
    state.caller = callerOk();
    state.url = SHEET_URL;
    state.project = PROJECT;
    state.contacts = CONTACTS;

    const response = await get();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ contacts: CONTACTS });
    expect(state.sheetArgs).toEqual({
      url: SHEET_URL,
      project: PROJECT,
      token: "show-token",
    });
  });
});
