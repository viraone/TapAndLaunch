import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GOOGLE_SCOPES,
  buildAuthUrl,
  grantedScopes,
  signState,
  stateExpiry,
  verifyState,
} from "./oauth";

const KEY = randomBytes(32).toString("base64");
const NOW = 1_800_000_000_000; // A fixed "now" in milliseconds.
const PAYLOAD = {
  appId: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
  nonce: "nonce-from-the-cookie",
  exp: Math.floor(NOW / 1000) + 600,
};

function flip(part: string): string {
  return `${part[0] === "A" ? "B" : "A"}${part.slice(1)}`;
}

describe("buildAuthUrl", () => {
  it("asks Google for a code with every parameter the connection needs", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "client-123",
        redirectUri: "https://tapandlaunch.com/api/integrations/google/callback",
        state: "signed-state",
      })
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://tapandlaunch.com/api/integrations/google/callback"
    );
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([...GOOGLE_SCOPES]);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("include_granted_scopes")).toBe("false");
    expect(url.searchParams.get("state")).toBe("signed-state");
  });
});

describe("signState / verifyState", () => {
  it("round trips the signed fields", () => {
    expect(verifyState(signState(PAYLOAD, KEY), KEY, NOW)).toEqual({
      appId: PAYLOAD.appId,
      userId: PAYLOAD.userId,
      nonce: PAYLOAD.nonce,
    });
    // A state made before `kind` existed has none.
    expect(verifyState(signState(PAYLOAD, KEY), KEY, NOW)).not.toHaveProperty("kind");
  });

  it("round trips the open mic kind", () => {
    const state = signState({ ...PAYLOAD, kind: "openmic" }, KEY);

    expect(verifyState(state, KEY, NOW)).toEqual({
      appId: PAYLOAD.appId,
      userId: PAYLOAD.userId,
      nonce: PAYLOAD.nonce,
      kind: "openmic",
    });
  });

  it("refuses a tampered kind", () => {
    const [body, signature] = signState({ ...PAYLOAD, kind: "openmic" }, KEY).split(".");
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    parsed.kind = "dashboard";
    const tampered = `${Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url")}.${signature}`;

    expect(verifyState(tampered, KEY, NOW)).toBeNull();
  });

  it("refuses a changed payload", () => {
    const [body, signature] = signState(PAYLOAD, KEY).split(".");
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    parsed.appId = "33333333-3333-3333-3333-333333333333";
    const tampered = `${Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url")}.${signature}`;

    expect(verifyState(tampered, KEY, NOW)).toBeNull();
  });

  it("refuses a changed signature", () => {
    const [body, signature] = signState(PAYLOAD, KEY).split(".");
    expect(verifyState(`${body}.${flip(signature)}`, KEY, NOW)).toBeNull();
  });

  it("refuses an expired state", () => {
    const state = signState(PAYLOAD, KEY);
    expect(verifyState(state, KEY, NOW + 600_000)).toBeNull();
    // One second before it runs out is still fine.
    expect(verifyState(state, KEY, NOW + 599_000)).not.toBeNull();
  });

  it("refuses a state signed with another key", () => {
    const otherKey = randomBytes(32).toString("base64");
    expect(verifyState(signState(PAYLOAD, KEY), otherKey, NOW)).toBeNull();
  });

  it("refuses malformed state", () => {
    for (const bad of ["", "one-part", "a.b.c", "payload.not-base64!", ".signature"]) {
      expect(verifyState(bad, KEY, NOW)).toBeNull();
    }
  });

  it("lives for ten minutes from now", () => {
    expect(stateExpiry(NOW)).toBe(Math.floor(NOW / 1000) + 600);
  });
});

describe("grantedScopes", () => {
  it("splits Google's space-separated scope field", () => {
    expect(grantedScopes("openid email  https://www.googleapis.com/auth/gmail.send")).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.send",
    ]);
  });

  it("returns nothing for a missing or non-string field", () => {
    expect(grantedScopes(undefined)).toEqual([]);
    expect(grantedScopes(null)).toEqual([]);
    expect(grantedScopes(42)).toEqual([]);
    expect(grantedScopes("")).toEqual([]);
  });
});
