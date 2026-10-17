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
