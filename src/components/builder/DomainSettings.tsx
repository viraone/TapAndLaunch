"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];

export function DomainSettings({ app, onUpdated }: { app: AppRow; onUpdated: (app: AppRow) => void }) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/apps/${app.id}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to add domain");
        return;
      }
      onUpdated(body.app);
      setDomain("");
      toast.success(body.app.custom_domain_status === "verified" ? "Domain verified" : "Domain added. Now add the DNS record below where you bought the domain.");
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
      toast.success(body.app.custom_domain_status === "verified" ? "Domain verified" : "Not working yet. DNS changes can take from a few minutes to a few hours.");
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
      onUpdated({ ...app, custom_domain: null, custom_domain_status: null, custom_domain_verification: [] });
      toast.success("Domain removed");
    } finally {
      setBusy(false);
    }
  }

  if (!app.custom_domain) {
    return (
      <form onSubmit={handleAdd} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="custom-domain">Custom domain</Label>
          <Input
            id="custom-domain"
            placeholder="app.yourbrand.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your app stays reachable at its {"{slug}"}.subdomain either way — a custom domain is
          additional, not a replacement.
        </p>
        <Button type="submit" disabled={busy || !domain}>
          {busy ? "Adding…" : "Add domain"}
        </Button>
      </form>
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

      {app.custom_domain_status !== "verified" && app.custom_domain_verification.length > 0 && (
        <div className="space-y-1 rounded-md border p-3 text-xs">
          <p className="font-medium">Add this at the company where you bought your domain (GoDaddy, Namecheap, Google, ...), in its DNS settings:</p>
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
          <p className="text-muted-foreground">Type = the kind of record, then its name (host), then its value. Once it works, tap Check again; the secure padlock (SSL) turns on by itself.</p>
        </div>
      )}

      <div className="flex gap-2">
        {app.custom_domain_status !== "verified" && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleVerify}>
            Check again
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
          Remove domain
        </Button>
      </div>
    </div>
  );
}
