import { describe, expect, it, vi } from "vitest";

// auth.ts pulls in server-only modules that register nothing at import time; the pure helpers below need none of
// them, so stand them in rather than loading the Next runtime in a node test.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/pwa/data", () => ({ getPublishedApp: async () => null }));
vi.mock("@/lib/openmic/push-server", () => ({
  comicFromToken: async () => null,
  isHostToken: async () => false,
  showProjectFor: async () => null,
}));
vi.mock("./config", () => ({ automationEmailsFor: async () => undefined }));

import { bearerToken, isAllowedEmail } from "./auth";

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/automation", { headers });
}

describe("isAllowedEmail", () => {
  it("matches an address regardless of case and surrounding spaces", () => {
    expect(isAllowedEmail("Owner@Example.COM", ["owner@example.com"])).toBe(true);
    expect(isAllowedEmail("  owner@example.com ", ["  OWNER@example.com  "])).toBe(true);
    expect(isAllowedEmail("owner@example.com", ["someone@example.com", "OWNER@example.com"])).toBe(
      true
    );
  });

  it("refuses an address that is not listed", () => {
    expect(isAllowedEmail("other@example.com", ["owner@example.com"])).toBe(false);
  });

  it("lets nobody in for an empty or missing list", () => {
    expect(isAllowedEmail("owner@example.com", [])).toBe(false);
    expect(isAllowedEmail("owner@example.com", undefined)).toBe(false);
  });

  it("refuses an empty address", () => {
    expect(isAllowedEmail("", ["owner@example.com"])).toBe(false);
    expect(isAllowedEmail("   ", ["   "])).toBe(false);
  });
});

describe("bearerToken", () => {
  it("returns the token after the Bearer scheme", () => {
    expect(bearerToken(request({ authorization: "Bearer show-token-123" }))).toBe("show-token-123");
  });

  it("accepts the scheme in any case, as HTTP defines it", () => {
    expect(bearerToken(request({ authorization: "bearer show-token-123" }))).toBe("show-token-123");
  });

  it("refuses a missing header or another scheme", () => {
    expect(bearerToken(request())).toBeNull();
    expect(bearerToken(request({ authorization: "Basic show-token-123" }))).toBeNull();
    expect(bearerToken(request({ authorization: "show-token-123" }))).toBeNull();
  });

  it("refuses a Bearer header with no token", () => {
    expect(bearerToken(request({ authorization: "Bearer" }))).toBeNull();
    expect(bearerToken(request({ authorization: "Bearer " }))).toBeNull();
  });
});
