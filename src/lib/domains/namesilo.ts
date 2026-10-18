import "server-only";
import type { DomainVerificationRecord } from "@/types/database";
import { registeredDomain } from "./dns";

/**
 * NameSilo, the registrar where TapAndLaunch buys domains for its customers. When a customer types a domain that
 * lives in the platform's NameSilo account, the server writes the DNS records itself instead of showing them to add
 * by hand. Domains bought anywhere else are untouched: the Domain tab then works exactly as before.
 *
 * API: GET https://www.namesilo.com/api/<operation>?version=1&type=json&key=… ; a reply's `code` 300 means success,
 * anything else is an error with a `detail`. Lists come back as an array when there are several items and as one
 * object when there is one, so every list is read through `asList`. The key never appears in logs or errors.
 */

const API = "https://www.namesilo.com/api";
/** NameSilo's own nameservers. Records set through its API only count when the domain still uses them. */
const NAMESILO_NS = /\.dnsowl\.com$/i;
const TTL = "3600";

export function isNameSiloConfigured(): boolean {
  return !!process.env.NAMESILO_API_KEY;
}

type Reply = Record<string, unknown> & { code?: number | string; detail?: string };

async function call(operation: string, params: Record<string, string>): Promise<Reply> {
  const url = new URL(`${API}/${operation}`);
  url.searchParams.set("version", "1");
  url.searchParams.set("type", "json");
  url.searchParams.set("key", process.env.NAMESILO_API_KEY ?? "");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as { reply?: Reply } | null;
  return body?.reply ?? { code: res.status, detail: `NameSilo answered ${res.status}` };
}

const succeeded = (r: Reply) => Number(r.code) === 300;
const asList = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : v == null ? [] : [v as T]);

export interface NameSiloRecord {
  id: string;
  type: string;
  /** The host as NameSilo lists it: `@` for the root and a bare label (`www`) for a subdomain, though a full name
   * (`brand.com`, `www.brand.com`) is accepted too. Compare with `hostLabel`, never as text. */
  host: string;
  value: string;
}

export type DnsAction =
  | { kind: "add"; type: string; host: string; value: string }
  | { kind: "update"; id: string; type: string; host: string; value: string }
  | { kind: "delete"; id: string };

/** The record's host as a label relative to the registered domain: `@`, `brand.com` and `` all mean the root. */
export function hostLabel(root: string, recordDomain: string): string {
  const d = recordDomain.trim().toLowerCase().replace(/\.$/, "");
  if (d === "" || d === "@" || d === root) return "";
  return d.endsWith(`.${root}`) ? d.slice(0, -(root.length + 1)) : d;
}

const same = (a: string, b: string) => a.trim().toLowerCase().replace(/\.$/, "") === b.trim().toLowerCase().replace(/\.$/, "");
const ROUTING = new Set(["A", "AAAA", "CNAME"]);

/**
 * What to change at NameSilo so `wanted` holds. A and CNAME records replace whatever else routes that host (a new
 * domain comes with parking records that would otherwise keep answering); a TXT record is only added when missing.
 * Deletes come first: NameSilo refuses a CNAME next to an A record on the same host.
 */
export function planRecords(root: string, wanted: DomainVerificationRecord[], existing: NameSiloRecord[]): DnsAction[] {
  const deletes: DnsAction[] = [];
  const rest: DnsAction[] = [];
  for (const want of wanted) {
    const type = want.type.toUpperCase();
    const label = hostLabel(root, want.domain);
    // A fresh domain's parking records come back with host `@` (seen on the first real one), so match by label.
    const atHost = existing.filter((r) => hostLabel(root, r.host) === label);
    const match = atHost.find((r) => r.type.toUpperCase() === type && same(r.value, want.value));
    if (ROUTING.has(type)) {
      const keep = match ?? atHost.find((r) => r.type.toUpperCase() === type);
      for (const r of atHost) if (ROUTING.has(r.type.toUpperCase()) && r !== keep) deletes.push({ kind: "delete", id: r.id });
      if (match) continue;
      if (keep) rest.push({ kind: "update", id: keep.id, type, host: label, value: want.value });
      else rest.push({ kind: "add", type, host: label, value: want.value });
    } else if (!match) {
      rest.push({ kind: "add", type, host: label, value: want.value });
    }
  }
  return [...deletes, ...rest];
}

export async function listRecords(root: string): Promise<{ records: NameSiloRecord[]; error?: string }> {
  const r = await call("dnsListRecords", { domain: root });
  if (!succeeded(r)) return { records: [], error: r.detail ?? "Could not read the DNS records" };
  const raw = asList<Record<string, unknown>>(r.resource_record);
  return { records: raw.map((x) => ({ id: String(x.record_id ?? ""), type: String(x.type ?? ""), host: String(x.host ?? ""), value: String(x.value ?? "") })) };
}

async function run(root: string, action: DnsAction): Promise<string | null> {
  const r =
    action.kind === "delete"
      ? await call("dnsDeleteRecord", { domain: root, rrid: action.id })
      : action.kind === "update"
        ? await call("dnsUpdateRecord", { domain: root, rrid: action.id, rrhost: action.host, rrvalue: action.value, rrttl: TTL })
        : await call("dnsAddRecord", { domain: root, rrtype: action.type, rrhost: action.host, rrvalue: action.value, rrttl: TTL });
  return succeeded(r) ? null : (r.detail ?? "NameSilo refused the change");
}

export type PointResult =
  /** The domain is in the account and its records now point here. */
  | { status: "set"; changes: number }
  /** Not ours: bought somewhere else, or not in this account. Nothing was touched. */
  | { status: "not_here" }
  /** In the account, but its DNS is run elsewhere (other nameservers), so records here would not count. */
  | { status: "other_dns" }
  | { status: "failed"; error: string };

/**
 * Points a domain at TapAndLaunch by writing the records Vercel asked for, when the domain is in the platform's
 * NameSilo account. `domain` may be a subdomain; the records are written on its registered domain.
 */
export async function pointDomainAtUs(domain: string, wanted: DomainVerificationRecord[]): Promise<PointResult> {
  if (!isNameSiloConfigured() || wanted.length === 0) return { status: "not_here" };
  const root = registeredDomain(domain);
  try {
    const info = await call("getDomainInfo", { domain: root });
    if (!succeeded(info)) return { status: "not_here" };
    const ns = asList<string>((info.nameservers as { nameserver?: unknown } | undefined)?.nameserver).map(String);
    if (ns.length > 0 && !ns.every((n) => NAMESILO_NS.test(n))) return { status: "other_dns" };

    const { records, error } = await listRecords(root);
    if (error) return { status: "failed", error };
    const actions = planRecords(root, wanted, records);
    for (const action of actions) {
      const failure = await run(root, action);
      if (failure) return { status: "failed", error: failure };
    }
    return { status: "set", changes: actions.length };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "Could not reach NameSilo" };
  }
}
