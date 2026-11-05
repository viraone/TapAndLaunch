import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  table: "",
  row: null as Record<string, unknown> | null,
  options: null as Record<string, unknown> | null,
  statusRow: null as Record<string, unknown> | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      upsert: async (row: Record<string, unknown>, options: Record<string, unknown>) => {
        state.table = table;
        state.row = row;
        state.options = options;
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.statusRow, error: null }),
        }),
      }),
    }),
  }),
}));

import { getConnectionStatus, saveConnection } from "./connection";
import { CONTACTS_OTHER_READONLY_SCOPE, CONTACTS_READONLY_SCOPE, GMAIL_SEND_SCOPE } from "./oauth";

const original = {
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  key: process.env.GOOGLE_TOKEN_ENC_KEY,
};

beforeEach(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client-secret";
  process.env.GOOGLE_TOKEN_ENC_KEY = randomBytes(32).toString("base64");
  state.table = "";
  state.row = null;
  state.options = null;
  state.statusRow = null;
});

afterEach(() => {
  if (original.clientId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  else process.env.GOOGLE_OAUTH_CLIENT_ID = original.clientId;
  if (original.clientSecret === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  else process.env.GOOGLE_OAUTH_CLIENT_SECRET = original.clientSecret;
  if (original.key === undefined) delete process.env.GOOGLE_TOKEN_ENC_KEY;
  else process.env.GOOGLE_TOKEN_ENC_KEY = original.key;
});

describe("getConnectionStatus", () => {
  it("answers each permission from the saved scopes", async () => {
    state.statusRow = {
      google_email: "owner@example.com",
      scopes: [GMAIL_SEND_SCOPE, CONTACTS_READONLY_SCOPE],
      connected_at: "2026-11-04T12:00:00.000Z",
      last_error: null,
    };

    await expect(getConnectionStatus("app_1")).resolves.toEqual({
      connected: true,
      email: "owner@example.com",
      connectedAt: "2026-11-04T12:00:00.000Z",
      canSend: true,
      canReadContacts: true,
      canReadOtherContacts: false,
      needsReconnect: false,
    });
  });

  it("reports Other contacts on its own", async () => {
    state.statusRow = {
      google_email: "owner@example.com",
      scopes: [CONTACTS_OTHER_READONLY_SCOPE],
      connected_at: null,
      last_error: "reconnect",
    };

    await expect(getConnectionStatus("app_1")).resolves.toEqual({
      connected: true,
      email: "owner@example.com",
      connectedAt: null,
      canSend: false,
      canReadContacts: false,
      canReadOtherContacts: true,
      needsReconnect: true,
    });
  });

  it("turns every permission off when nothing is connected", async () => {
    state.statusRow = null;

    await expect(getConnectionStatus("app_1")).resolves.toEqual({
      connected: false,
      email: null,
      connectedAt: null,
      canSend: false,
      canReadContacts: false,
      canReadOtherContacts: false,
      needsReconnect: false,
    });
  });
});

describe("saveConnection", () => {
  it("stores a null connected_by for a sign-in started inside a published app", async () => {
    const result = await saveConnection({
      appId: "app_1",
      userId: null,
      email: "owner@example.com",
      refreshToken: "refresh-token-123",
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
    });

    expect(result).toEqual({ ok: true });
    expect(state.table).toBe("google_connections");
    expect(state.options).toEqual({ onConflict: "app_id" });
    expect(state.row?.app_id).toBe("app_1");
    expect(state.row?.google_email).toBe("owner@example.com");
    expect(state.row?.connected_by).toBeNull();
    // The refresh token is sealed, never stored as it arrived.
    expect(state.row?.refresh_token_enc).not.toContain("refresh-token-123");
    expect(state.row?.scopes).toEqual(["https://www.googleapis.com/auth/gmail.send"]);
  });

  it("still records the TapAndLaunch user for the dashboard flow", async () => {
    await saveConnection({
      appId: "app_1",
      userId: "user_1",
      email: "owner@example.com",
      refreshToken: "refresh-token-123",
      scopes: [],
    });

    expect(state.row?.connected_by).toBe("user_1");
  });
});
