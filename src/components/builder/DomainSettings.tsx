"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { priceLabel } from "@/lib/domains/buy";
import type { Database } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];
type OrderRow = Database["public"]["Tables"]["domain_orders"]["Row"];
interface Offer {
  domain: string;
  available: boolean;
  priceCents: number | null;
  renewCents: number | null;
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/**
 * The Domain tab. Two ways to an address of your own: buy one here (search, pay the registrar's price, it is registered
 * and connected for you) or connect one bought elsewhere (the records to add by hand). Purchases are read from
 * `domain_orders`, so a half-finished one (paid, registering) or a failed one is shown too.
 */
export function DomainSettings({ app, onUpdated }: { app: AppRow; onUpdated: (app: AppRow) => void }) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [canBuy, setCanBuy] = useState(false);
  const [query, setQuery] = useState("");
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [ownDomainOpen, setOwnDomainOpen] = useState(false);

  // Purchases are re-read when the tab opens, when the domain changes, and on "Refresh" (`reloadTick`).
  const [reloadTick, setReloadTick] = useState(0);
  const loadOrders = () => setReloadTick((t) => t + 1);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/apps/${app.id}/domain/orders`)
      .then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setOrders(body.orders ?? []);
        setCanBuy(!!body.canBuy);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [app.id, app.custom_domain, reloadTick]);

  async function addDomain(name: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/apps/${app.id}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: name }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to add domain");
        return;
      }
      onUpdated(body.app);
      setDomain("");
      if (body.app.custom_domain_status === "verified") toast.success("Domain connected");
      else if (body.dns === "set") toast.success("Domain added and its DNS set for you. Connecting usually takes a few minutes.");
      else if (body.dns === "failed") toast.warning(`Domain added, but its DNS could not be set for you (${body.dnsError ?? "unknown reason"}). Add the records below by hand.`);
      else toast.success("Domain added. Now add the DNS records below where you bought the domain.");
      if (body.companionError) toast.warning(`The other spelling of the address (www or without) could not be added as a redirect (${body.companionError}). Try removing and adding the domain again later.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    try {
      const res = await fetch(`/api/apps/${app.id}/domain/verify`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to check verification");
        return;
      }
      onUpdated(body.app);
      if (body.app.custom_domain_status !== "verified") toast.success("Not working yet. DNS changes can take from a few minutes to a few hours.");
      else if (body.app.custom_domain_verification.length > 0) toast.success("Domain connected. One record is still missing for the other spelling of the address.");
      else toast.success("Domain connected");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/apps/${app.id}/domain`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to remove domain");
        return;
      }
      onUpdated({ ...app, custom_domain: null, custom_domain_status: null, custom_domain_verification: [], custom_domain_dns: null });
      toast.success("Domain removed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const res = await fetch(`/api/apps/${app.id}/domain/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Search failed");
        return;
      }
      setOffers(body.offers ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function handleBuy(name: string) {
    setBuying(name);
    try {
      const res = await fetch(`/api/apps/${app.id}/domain/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: name }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't start the purchase");
        setBuying(null);
        return;
      }
      // Off to Stripe's page; it comes back to the builder, which opens this tab on the result.
      window.location.assign(body.url);
    } catch {
      setBuying(null);
    }
  }

  // A domain bought here and not yet on a site: connecting it records the site on the order too.
  async function connectOwned(order: OrderRow) {
    setBusy(true);
    try {
      const res = await fetch(`/api/domains/${order.id}/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: app.id }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't connect the domain");
        return;
      }
      onUpdated(body.app);
      toast.success(body.app.custom_domain_status === "verified" ? "Domain connected" : "Domain connected. It starts working in a few minutes, once its DNS has spread.");
    } finally {
      setBusy(false);
    }
  }

  const bought = orders.find((o) => o.status === "registered");
  const settingUp = orders.find((o) => o.status === "paid");
  const failed = orders.find((o) => o.status === "failed");
  const boughtHere = bought && app.custom_domain && bought.domain === app.custom_domain ? bought : null;

  if (!app.custom_domain) {
    const ownDomainForm = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void addDomain(domain);
        }}
        className="space-y-3"
      >
        <div className="space-y-1">
          <Label htmlFor="custom-domain">{canBuy ? "Your domain" : "Custom domain"}</Label>
          <Input id="custom-domain" placeholder="yourbrand.com" value={domain} onChange={(e) => setDomain(e.target.value)} required />
        </div>
        <p className="text-xs text-muted-foreground">
          Your site stays reachable at its {"{slug}"}.subdomain either way — a custom domain is additional, not a replacement. A root domain
          (yourbrand.com) gets its www. version too, and the other way round.
        </p>
        <Button type="submit" disabled={busy || !domain}>
          {busy ? "Adding…" : "Connect domain"}
        </Button>
      </form>
    );

    return (
      <div className="space-y-5">
        {settingUp && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">Payment received. {settingUp.domain} is being registered and connected.</p>
            <p className="text-xs text-muted-foreground">This usually takes under a minute.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadOrders()}>
              Refresh
            </Button>
          </div>
        )}

        {failed && (
          <div className="space-y-1 rounded-md border border-amber-500/40 p-3 text-sm">
            <p className="font-medium">We took your payment for {failed.domain}, but the registration failed.</p>
            <p className="text-xs text-muted-foreground">You will get a full refund. {failed.error ? `Reason: ${failed.error}` : ""}</p>
          </div>
        )}

        {bought && !settingUp && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">{bought.domain} is yours (bought {longDate(bought.created_at)}).</p>
            {bought.error && <p className="text-xs text-muted-foreground">{bought.error}</p>}
            <Button type="button" size="sm" disabled={busy} onClick={() => void connectOwned(bought)}>
              {busy ? "Connecting…" : "Connect it to this site"}
            </Button>
          </div>
        )}

        {canBuy && !bought && !settingUp && (
          <div className="space-y-3">
            <form onSubmit={handleSearch} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="domain-search">Get your own address</Label>
                <div className="flex gap-2">
                  <Input
                    id="domain-search"
                    placeholder="costumecontestsseattle, or the words of your name"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    maxLength={100}
                  />
                  <Button type="submit" disabled={searching || query.trim().length === 0}>
                    {searching ? "Checking…" : "Search"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You pay the registrar&apos;s price, nothing on top. We register it for you with privacy for your contact details and connect it
                to this site. It renews each year; we&apos;ll be in touch before then. Your domains are listed under{" "}
                <a href="/dashboard/domains" target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  Dashboard › Domains
                </a>
                .
              </p>
            </form>

            {offers && offers.length > 0 && (
              <ul className="divide-y rounded-md border text-sm">
                {offers.map((o) => (
                  <li key={o.domain} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.domain}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.available && o.priceCents != null && o.renewCents != null ? priceLabel(o.priceCents, o.renewCents) : "Taken"}
                      </p>
                    </div>
                    {o.available && (
                      <Button type="button" size="sm" disabled={!!buying} onClick={() => void handleBuy(o.domain)}>
                        {buying === o.domain ? "Opening checkout…" : "Buy and connect"}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {offers && offers.length === 0 && <p className="text-xs text-muted-foreground">Nothing to show for that. Try other words.</p>}
          </div>
        )}

        {canBuy && !bought ? (
          <div className="border-t pt-4">
            <button type="button" className="text-sm underline underline-offset-4" onClick={() => setOwnDomainOpen((v) => !v)}>
              {ownDomainOpen ? "Hide" : "Already have a domain? Connect it"}
            </button>
            {ownDomainOpen && <div className="mt-3">{ownDomainForm}</div>}
          </div>
        ) : (
          !bought && ownDomainForm
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-medium">{app.custom_domain}</span>
        <Badge variant={app.custom_domain_status === "verified" ? "default" : "secondary"}>
          {app.custom_domain_status === "verified" ? "Connected" : app.custom_domain_status === "error" ? "Error" : "Waiting for DNS"}
        </Badge>
      </div>

      {boughtHere && (
        <p className="text-xs text-muted-foreground">
          Bought through TapAndLaunch on {longDate(boughtHere.created_at)}
          {boughtHere.expires_at ? `; renews ${longDate(boughtHere.expires_at)}` : ""}.
        </p>
      )}

      {app.custom_domain_status !== "verified" && app.custom_domain_dns === "namesilo" && (
        <p className="rounded-md border p-3 text-xs">
          The DNS records were set for you. Connecting usually takes a few minutes, sometimes up to an hour. Tap Check again in a while; the secure padlock (SSL) turns on by itself.
        </p>
      )}

      {app.custom_domain_dns !== "namesilo" && app.custom_domain_verification.length > 0 && (
        <div className="space-y-1 rounded-md border p-3 text-xs">
          <p className="font-medium">
            {app.custom_domain_status === "verified"
              ? "One more record so the other spelling of your address works too. Add it at the company where you bought your domain, in its DNS settings:"
              : "Add this at the company where you bought your domain (GoDaddy, Namecheap, Google, ...), in its DNS settings:"}
          </p>
          <table className="w-full">
            <tbody>
              {app.custom_domain_verification.map((record, i) => (
                <tr key={i} className="border-t first:border-t-0">
                  <td className="py-1 pr-2 font-mono uppercase">{record.type}</td>
                  <td className="py-1 pr-2 font-mono">{record.domain}</td>
                  <td className="py-1 font-mono break-all">{record.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground">
            Type = the kind of record, then its name (host), then its value. Once it works, tap Check again
            {app.custom_domain_status === "verified" ? "." : "; the secure padlock (SSL) turns on by itself."}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {(app.custom_domain_status !== "verified" || (app.custom_domain_dns !== "namesilo" && app.custom_domain_verification.length > 0)) && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleVerify}>
            Check again
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
          {boughtHere ? "Disconnect domain" : "Remove domain"}
        </Button>
      </div>
      {boughtHere && <p className="text-xs text-muted-foreground">Disconnecting only unlinks it from this site; the domain stays yours.</p>}
    </div>
  );
}
