import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { addDomain, ensureRedirect, removeDomain, verifyDomain } from "./vercel";

type Answer = { status: number; body?: unknown };
type Call = { method: string; path: string; body?: Record<string, unknown> };

/** Answers Vercel's API from a table keyed by "METHOD /path" (query string dropped), recording every call. */
function vercel(answers: Record<string, Answer | ((call: Call) => Answer)>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      const call: Call = { method: init?.method ?? "GET", path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(call);
      const key = `${call.method} ${call.path}`;
      const found = answers[key];
      const answer = typeof found === "function" ? found(call) : (found ?? { status: 404, body: { error: { code: "not_found", message: `no answer for ${key}` } } });
      return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body ?? {} };
    })
  );
  return calls;
}

const PROJECT = "/v10/projects/prj_test/domains";
const config = (misconfigured: boolean) => ({ status: 200, body: { misconfigured, recommendedIPv4: [{ rank: 1, value: ["216.198.79.1"] }], recommendedCNAME: [{ rank: 1, value: "cname.vercel-dns.com." }] } });
const summary = (calls: Call[]) => calls.map((c) => `${c.method} ${c.path}`);

describe("Vercel domains with a www twin", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.VERCEL_API_TOKEN = "tok";
    process.env.VERCEL_PROJECT_ID = "prj_test";
    delete process.env.VERCEL_TEAM_ID;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...env };
  });

  it("adds a root domain and its www as a 308 redirect, listing the A record and the www CNAME while DNS is missing", async () => {
    const calls = vercel({
      [`POST ${PROJECT}`]: { status: 200, body: { name: "brand.com", verified: true } },
      "GET /v6/domains/brand.com/config": config(true),
      "GET /v6/domains/www.brand.com/config": config(true),
    });
    const result = await addDomain("brand.com");

    const adds = calls.filter((c) => c.method === "POST").map((c) => c.body);
    expect(adds).toEqual([{ name: "brand.com" }, { name: "www.brand.com", redirect: "brand.com", redirectStatusCode: 308 }]);
    expect(result.verified).toBe(false);
    expect(result.companionError).toBeUndefined();
    expect(result.verification).toEqual([
      { type: "A", domain: "@", value: "216.198.79.1", reason: "Points your domain at TapAndLaunch" },
      { type: "CNAME", domain: "www", value: "cname.vercel-dns.com", reason: "Sends www.brand.com to brand.com" },
    ]);
  });

  it("is verified once the root routes, with only the www CNAME left on the list", async () => {
    vercel({
      [`POST ${PROJECT}`]: { status: 200, body: { verified: true } },
      "GET /v6/domains/brand.com/config": config(false),
      "GET /v6/domains/www.brand.com/config": config(true),
    });
    const result = await addDomain("brand.com");
    expect(result.verified).toBe(true);
    expect(result.verification.map((r) => r.domain)).toEqual(["www"]);
  });

  it("lists nothing more once both spellings route", async () => {
    vercel({
      "POST /v9/projects/prj_test/domains/brand.com/verify": { status: 200, body: { verified: true } },
      "GET /v6/domains/brand.com/config": config(false),
      "GET /v6/domains/www.brand.com/config": config(false),
    });
    const result = await verifyDomain("brand.com");
    expect(result).toEqual({ verified: true, verification: [] });
  });

  it("mirrors it when the customer connects www: the root becomes the redirect and its A record is listed", async () => {
    const calls = vercel({
      [`POST ${PROJECT}`]: { status: 200, body: { verified: true } },
      "GET /v6/domains/www.brand.com/config": config(false),
      "GET /v6/domains/brand.com/config": config(true),
    });
    const result = await addDomain("www.brand.com");
    expect(calls.filter((c) => c.method === "POST")[1]?.body).toEqual({ name: "brand.com", redirect: "www.brand.com", redirectStatusCode: 308 });
    expect(result.verified).toBe(true);
    expect(result.verification).toEqual([{ type: "A", domain: "@", value: "216.198.79.1", reason: "Sends brand.com to www.brand.com" }]);
  });

  it("adds nothing extra for a plain subdomain", async () => {
    const calls = vercel({
      [`POST ${PROJECT}`]: { status: 200, body: { verified: true } },
      "GET /v6/domains/app.brand.com/config": config(false),
    });
    const result = await addDomain("app.brand.com");
    expect(summary(calls)).toEqual([`POST ${PROJECT}`, "GET /v6/domains/app.brand.com/config"]);
    expect(result).toEqual({ verified: true, verification: [] });
  });

  it("leaves the twin alone when told another app owns it", async () => {
    const calls = vercel({
      [`POST ${PROJECT}`]: { status: 200, body: { verified: true } },
      "GET /v6/domains/brand.com/config": config(false),
    });
    const result = await addDomain("brand.com", { companion: false });
    expect(summary(calls)).toEqual([`POST ${PROJECT}`, "GET /v6/domains/brand.com/config"]);
    expect(result.verification).toEqual([]);
  });

  it("treats a www that is already on the project as fine, setting its redirect", async () => {
    const calls = vercel({
      [`POST ${PROJECT}`]: (call) =>
        call.body?.name === "www.brand.com"
          ? { status: 409, body: { error: { code: "domain_already_in_use", message: "Domain www.brand.com is already in use" } } }
          : { status: 200, body: { verified: true } },
      "PATCH /v9/projects/prj_test/domains/www.brand.com": { status: 200, body: {} },
      "GET /v6/domains/brand.com/config": config(false),
      "GET /v6/domains/www.brand.com/config": config(false),
    });
    const result = await addDomain("brand.com");
    expect(result.companionError).toBeUndefined();
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ redirect: "brand.com", redirectStatusCode: 308 });
  });

  it("reports a failed www redirect without failing the domain itself", async () => {
    vercel({
      [`POST ${PROJECT}`]: (call) =>
        call.body?.name === "www.brand.com" ? { status: 400, body: { error: { code: "bad", message: "www is not for you" } } } : { status: 200, body: { verified: true } },
      "GET /v6/domains/brand.com/config": config(false),
      "GET /v6/domains/www.brand.com/config": config(true),
    });
    const result = await addDomain("brand.com");
    expect(result.error).toBeUndefined();
    expect(result.verified).toBe(true);
    expect(result.companionError).toBe("www is not for you");
  });

  it("ensureRedirect sends exactly what Vercel wants", async () => {
    const calls = vercel({ [`POST ${PROJECT}`]: { status: 200, body: {} } });
    expect(await ensureRedirect("www.brand.com", "brand.com")).toEqual({ ok: true });
    expect(calls[0].body).toEqual({ name: "www.brand.com", redirect: "brand.com", redirectStatusCode: 308 });
  });

  it("removes the www along with the root, and a 404 on either counts as removed", async () => {
    const calls = vercel({
      "DELETE /v9/projects/prj_test/domains/brand.com": { status: 200, body: {} },
      "DELETE /v9/projects/prj_test/domains/www.brand.com": { status: 404, body: { error: { code: "not_found", message: "gone" } } },
    });
    expect(await removeDomain("brand.com")).toEqual({ ok: true });
    expect(summary(calls)).toEqual(["DELETE /v9/projects/prj_test/domains/brand.com", "DELETE /v9/projects/prj_test/domains/www.brand.com"]);
  });

  it("does not remove a twin another app owns", async () => {
    const calls = vercel({ "DELETE /v9/projects/prj_test/domains/brand.com": { status: 200, body: {} } });
    expect(await removeDomain("brand.com", { companion: false })).toEqual({ ok: true });
    expect(summary(calls)).toEqual(["DELETE /v9/projects/prj_test/domains/brand.com"]);
  });
});
