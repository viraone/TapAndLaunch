import { afterEach, describe, expect, it, vi } from "vitest";
import { registeredDomain } from "./dns";

vi.mock("server-only", () => ({}));

import { hostLabel, planRecords, pointDomainAtUs, type NameSiloRecord } from "./namesilo";

const A = { type: "A", domain: "@", value: "216.198.79.1", reason: "Points your domain at TapAndLaunch" };
const CNAME = { type: "CNAME", domain: "app", value: "cname.vercel-dns.com", reason: "Points your domain at TapAndLaunch" };
const TXT = { type: "TXT", domain: "_vercel.brand.com", value: "vc-domain-verify=abc" };
const rec = (id: string, type: string, host: string, value: string): NameSiloRecord => ({ id, type, host, value });

describe("registeredDomain", () => {
  it("finds the domain that was bought, under any subdomain", () => {
    expect(registeredDomain("brand.com")).toBe("brand.com");
    expect(registeredDomain("app.brand.com")).toBe("brand.com");
    expect(registeredDomain("shop.app.brand.com")).toBe("brand.com");
    expect(registeredDomain("www.brand.co.uk")).toBe("brand.co.uk");
    expect(registeredDomain("Brand.COM")).toBe("brand.com");
  });
});

describe("hostLabel", () => {
  it("reads Vercel's host spellings as a label under the registered domain", () => {
    expect(hostLabel("brand.com", "@")).toBe("");
    expect(hostLabel("brand.com", "brand.com")).toBe("");
    expect(hostLabel("brand.com", "app")).toBe("app");
    expect(hostLabel("brand.com", "_vercel.brand.com")).toBe("_vercel");
  });
});

describe("planRecords", () => {
  it("replaces a new domain's parking records with the A record, in one update plus deletes", () => {
    const existing = [rec("1", "A", "brand.com", "1.2.3.4"), rec("2", "A", "brand.com", "5.6.7.8"), rec("3", "CNAME", "www.brand.com", "brand.com")];
    expect(planRecords("brand.com", [A], existing)).toEqual([
      { kind: "delete", id: "2" },
      { kind: "update", id: "1", type: "A", host: "", value: "216.198.79.1" },
    ]);
  });

  it("matches hosts the way NameSilo really lists them: `@` for the root and a bare label for a subdomain", () => {
    // What seositetuneup.com came with on 2026-10-17: three parking A records on `@` and three on `www`.
    const parking = [rec("1", "A", "@", "172.232.24.235"), rec("2", "A", "@", "172.232.24.161"), rec("3", "A", "@", "172.234.25.42"), rec("4", "A", "www", "172.232.24.235"), rec("5", "TXT", "_domainconnect", "www.namesilo.com/domainconnect")];
    expect(planRecords("seositetuneup.com", [A], parking)).toEqual([
      { kind: "delete", id: "2" },
      { kind: "delete", id: "3" },
      { kind: "update", id: "1", type: "A", host: "", value: "216.198.79.1" },
    ]);
    expect(planRecords("brand.com", [CNAME], [rec("4", "A", "app", "1.2.3.4")])).toEqual([
      { kind: "delete", id: "4" },
      { kind: "add", type: "CNAME", host: "app", value: "cname.vercel-dns.com" },
    ]);
  });

  it("does nothing when the record is already right, except clear rivals on the same host", () => {
    expect(planRecords("brand.com", [A], [rec("1", "A", "brand.com", "216.198.79.1")])).toEqual([]);
    expect(planRecords("brand.com", [A], [rec("1", "A", "brand.com", "216.198.79.1"), rec("9", "AAAA", "brand.com", "::1")])).toEqual([{ kind: "delete", id: "9" }]);
  });

  it("adds a CNAME for a subdomain and removes an A record sitting on that host first", () => {
    expect(planRecords("brand.com", [CNAME], [rec("4", "A", "app.brand.com", "1.2.3.4"), rec("1", "A", "brand.com", "1.2.3.4")])).toEqual([
      { kind: "delete", id: "4" },
      { kind: "add", type: "CNAME", host: "app", value: "cname.vercel-dns.com" },
    ]);
  });

  it("adds a TXT record only when it is missing, leaving other TXT records alone", () => {
    expect(planRecords("brand.com", [TXT], [rec("7", "TXT", "_vercel.brand.com", "vc-domain-verify=other")])).toEqual([
      { kind: "add", type: "TXT", host: "_vercel", value: "vc-domain-verify=abc" },
    ]);
    expect(planRecords("brand.com", [TXT], [rec("7", "TXT", "_vercel.brand.com", "vc-domain-verify=abc")])).toEqual([]);
  });
});

describe("pointDomainAtUs", () => {
  const before = process.env.NAMESILO_API_KEY;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (before === undefined) delete process.env.NAMESILO_API_KEY;
    else process.env.NAMESILO_API_KEY = before;
  });

  /** Answers each NameSilo operation from a table, recording the calls (without the key). */
  function namesilo(answers: Record<string, unknown>) {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: URL | string) => {
      const url = new URL(String(input));
      const op = url.pathname.split("/").pop() ?? "";
      url.searchParams.delete("key");
      calls.push(`${op}?${url.searchParams.toString()}`);
      return { ok: true, status: 200, json: async () => ({ reply: answers[op] ?? { code: 200, detail: "Invalid API operation" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    return calls;
  }

  it("is a no-op without a key", async () => {
    delete process.env.NAMESILO_API_KEY;
    const calls = namesilo({});
    expect(await pointDomainAtUs("brand.com", [A])).toEqual({ status: "not_here" });
    expect(calls).toEqual([]);
  });

  it("leaves a domain alone when it is not in the account", async () => {
    process.env.NAMESILO_API_KEY = "test-key";
    const calls = namesilo({ getDomainInfo: { code: 200, detail: "Domain is not active, or does not belong to this user" } });
    expect(await pointDomainAtUs("app.brand.com", [CNAME])).toEqual({ status: "not_here" });
    expect(calls).toEqual(["getDomainInfo?version=1&type=json&domain=brand.com"]);
    expect(calls.join()).not.toContain("test-key");
  });

  it("stops when the domain's DNS is run somewhere else", async () => {
    process.env.NAMESILO_API_KEY = "test-key";
    namesilo({ getDomainInfo: { code: 300, nameservers: { nameserver: ["ns1.porkbun.com", "ns2.porkbun.com"] } } });
    expect(await pointDomainAtUs("brand.com", [A])).toEqual({ status: "other_dns" });
  });

  it("writes the records for a domain in the account, reading a one-record list as a list", async () => {
    process.env.NAMESILO_API_KEY = "test-key";
    const calls = namesilo({
      getDomainInfo: { code: 300, nameservers: { nameserver: ["ns1.dnsowl.com", "ns2.dnsowl.com", "ns3.dnsowl.com"] } },
      dnsListRecords: { code: 300, resource_record: { record_id: "11", type: "A", host: "brand.com", value: "1.2.3.4", ttl: "7207" } },
      dnsUpdateRecord: { code: 300, record_id: "12" },
    });
    expect(await pointDomainAtUs("brand.com", [A])).toEqual({ status: "set", changes: 1 });
    expect(calls[2]).toBe("dnsUpdateRecord?version=1&type=json&domain=brand.com&rrid=11&rrhost=&rrvalue=216.198.79.1&rrttl=3600");
  });

  it("reports NameSilo's own words when a change is refused", async () => {
    process.env.NAMESILO_API_KEY = "test-key";
    namesilo({
      getDomainInfo: { code: 300, nameservers: { nameserver: "ns1.dnsowl.com" } },
      dnsListRecords: { code: 300 },
      dnsAddRecord: { code: 280, detail: "DNS modification error" },
    });
    expect(await pointDomainAtUs("brand.com", [A])).toEqual({ status: "failed", error: "DNS modification error" });
  });
});

describe("checkAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("prices the available names and lists the rest as taken", async () => {
    vi.stubEnv("NAMESILO_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          reply: {
            code: 300,
            detail: "success",
            available: [{ domain: "brand.com", price: 17.29, renew: 17.29, premium: 0 }, { domain: "brand.org", price: 10.79, renew: 14.99, premium: 0 }],
            unavailable: "brand.net",
          },
        }),
      ),
    );
    const { checkAvailability } = await import("./namesilo");
    const { results, error } = await checkAvailability(["brand.com", "brand.net", "brand.org"]);
    expect(error).toBeUndefined();
    expect(results).toEqual([
      { domain: "brand.com", available: true, priceCents: 1729, renewCents: 1729, premium: false },
      { domain: "brand.org", available: true, priceCents: 1079, renewCents: 1499, premium: false },
      { domain: "brand.net", available: false, priceCents: null, renewCents: null, premium: false },
    ]);
  });

  it("reads a single result, which NameSilo wraps once more than a list", async () => {
    vi.stubEnv("NAMESILO_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ reply: { code: 300, detail: "success", available: { domain: { domain: "costumecontestsseattle.com", price: 17.29, renew: 17.29, premium: 0, duration: 10 } } } }),
      ),
    );
    const { checkAvailability } = await import("./namesilo");
    expect((await checkAvailability(["costumecontestsseattle.com"])).results).toEqual([
      { domain: "costumecontestsseattle.com", available: true, priceCents: 1729, renewCents: 1729, premium: false },
    ]);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ reply: { code: 300, detail: "success", unavailable: { domain: "taken.com" } } })));
    expect((await checkAvailability(["taken.com"])).results).toEqual([{ domain: "taken.com", available: false, priceCents: null, renewCents: null, premium: false }]);
  });

  it("reports NameSilo's refusal", async () => {
    vi.stubEnv("NAMESILO_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ reply: { code: 110, detail: "Invalid API key" } })));
    const { checkAvailability } = await import("./namesilo");
    expect(await checkAvailability(["brand.com"])).toEqual({ results: [], error: "Invalid API key" });
  });
});

describe("registerDomain", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("registers for the given years with privacy and auto-renew on, and never logs the key", async () => {
    vi.stubEnv("NAMESILO_API_KEY", "secret-key");
    const fetchMock = vi.fn<(input: URL | string) => Promise<Response>>(async () =>
      Response.json({ reply: { code: 300, detail: "success", message: "Your domain registration was successfully processed.", domain: "brand.com", order_amount: 17.29 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { registerDomain } = await import("./namesilo");
    expect(await registerDomain("brand.com", 1)).toEqual({ ok: true, orderAmount: 17.29 });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/api/registerDomain");
    expect(url.searchParams.get("domain")).toBe("brand.com");
    expect(url.searchParams.get("years")).toBe("1");
    expect(url.searchParams.get("private")).toBe("1");
    expect(url.searchParams.get("auto_renew")).toBe("1");
  });

  it("passes the registrar's reason on when it refuses", async () => {
    vi.stubEnv("NAMESILO_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ reply: { code: 261, detail: "Insufficient funds" } })));
    const { registerDomain } = await import("./namesilo");
    expect(await registerDomain("brand.com", 1)).toEqual({ ok: false, error: "Insufficient funds" });
  });

  it("pretends outside production when NAMESILO_FAKE_REGISTER is on", async () => {
    vi.stubEnv("NAMESILO_API_KEY", "k");
    vi.stubEnv("NAMESILO_FAKE_REGISTER", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerDomain } = await import("./namesilo");
    expect(await registerDomain("brand.com", 1)).toEqual({ ok: true, orderAmount: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
