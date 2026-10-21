"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ShippingRate } from "@/types/database";
import type { StoreSettings } from "@/lib/pwa/commerce";
import type { TaxReadiness } from "@/lib/stripe/tax";
import { MAX_SHIPPING_RATES } from "@/lib/store/cart";

function dollarsToCents(value: string): number {
  return Math.round(Number(value || "0") * 100);
}
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** A rate while it's being edited: money as typed, days as typed. */
interface RateDraft {
  name: string;
  amount: string;
  min_days: string;
  max_days: string;
}

function toDraft(r: ShippingRate): RateDraft {
  return { name: r.name, amount: centsToDollars(r.amount_cents), min_days: r.min_days?.toString() ?? "", max_days: r.max_days?.toString() ?? "" };
}

function fromDraft(d: RateDraft): ShippingRate {
  const rate: ShippingRate = { name: d.name.trim(), amount_cents: dollarsToCents(d.amount) };
  if (d.min_days.trim() !== "") rate.min_days = Number(d.min_days);
  if (d.max_days.trim() !== "") rate.max_days = Number(d.max_days);
  return rate;
}

/**
 * Shipping, sales tax and promo codes for this app's store. Each is a switch; the heavy lifting
 * (collecting the address, working out tax, applying a code) happens on Stripe's checkout page,
 * so these only work once Stripe is connected.
 */
export function StoreSettingsCard({
  appId,
  initial,
  paymentsOn,
  tax,
}: {
  appId: string;
  initial: StoreSettings;
  paymentsOn: boolean;
  tax: TaxReadiness;
}) {
  const [settings, setSettings] = useState(initial);
  const [rates, setRates] = useState<RateDraft[]>(initial.shipping_rates.map(toDraft));
  const [countries, setCountries] = useState(initial.ship_to_countries.join(", "));
  const [saving, setSaving] = useState(false);

  async function save(patch: Partial<StoreSettings>): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/store`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await res.json()) as { settings?: StoreSettings; error?: string };
      if (!res.ok || !body.settings) {
        toast.error(body.error ?? "Couldn't save");
        return false;
      }
      setSettings(body.settings);
      setRates(body.settings.shipping_rates.map(toDraft));
      setCountries(body.settings.ship_to_countries.join(", "));
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function toggle(key: "shipping_enabled" | "tax_enabled" | "promo_codes_enabled", on: boolean) {
    const patch: Partial<StoreSettings> = { [key]: on };
    // Turning shipping on with no rate yet: give them a default to edit rather than refusing.
    if (key === "shipping_enabled" && on && rates.length === 0) patch.shipping_rates = [{ name: "Standard shipping", amount_cents: 500 }];
    if (await save(patch)) toast.success(on ? "On" : "Off");
  }

  async function saveShipping() {
    const cleaned = rates.map(fromDraft).filter((r) => r.name);
    const ok = await save({
      shipping_rates: cleaned,
      ship_to_countries: countries
        .split(/[\s,]+/)
        .map((c) => c.trim())
        .filter(Boolean),
    });
    if (ok) toast.success("Shipping saved");
  }

  const off = !paymentsOn;

  return (
    <section className="space-y-5 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-medium">Checkout</h2>
        <p className="text-xs text-muted-foreground">
          {off
            ? "Connect Stripe in Settings → Payments to turn these on. Until then, shoppers send order requests."
            : "Handled on Stripe's checkout page. The address, tax and any discount show on each order."}
        </p>
      </div>

      {/* Shipping */}
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">Shipping</span>
            <span className="block text-xs text-muted-foreground">Ask for an address and offer these rates.</span>
          </span>
          <Switch checked={settings.shipping_enabled} disabled={off || saving} onCheckedChange={(on) => toggle("shipping_enabled", on)} />
        </label>
        {settings.shipping_enabled && (
          <div className="space-y-3 rounded-md bg-muted/40 p-3">
            {rates.map((rate, i) => (
              <div key={i} className="grid grid-cols-[1fr_6rem_4rem_4rem_auto] items-end gap-2">
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">Name</Label>}
                  <Input value={rate.name} placeholder="Standard" onChange={(e) => setRates((rs) => rs.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">Price</Label>}
                  <Input type="number" min="0" step="0.01" value={rate.amount} onChange={(e) => setRates((rs) => rs.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))} />
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">Days</Label>}
                  <Input type="number" min="0" placeholder="3" value={rate.min_days} onChange={(e) => setRates((rs) => rs.map((r, j) => (j === i ? { ...r, min_days: e.target.value } : r)))} />
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">to</Label>}
                  <Input type="number" min="0" placeholder="5" value={rate.max_days} onChange={(e) => setRates((rs) => rs.map((r, j) => (j === i ? { ...r, max_days: e.target.value } : r)))} />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove rate" onClick={() => setRates((rs) => rs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {rates.length < MAX_SHIPPING_RATES && (
              <Button type="button" variant="outline" size="sm" onClick={() => setRates((rs) => [...rs, { name: "", amount: "", min_days: "", max_days: "" }])}>
                <Plus className="mr-1 h-4 w-4" /> Add a rate
              </Button>
            )}
            <div className="space-y-1">
              <Label htmlFor="ship-to" className="text-xs">
                Ships to (country codes)
              </Label>
              <Input id="ship-to" value={countries} placeholder="US, CA" onChange={(e) => setCountries(e.target.value)} />
            </div>
            <Button type="button" size="sm" disabled={saving} onClick={saveShipping}>
              Save shipping
            </Button>
          </div>
        )}
      </div>

      {/* Sales tax */}
      <div className="space-y-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">Sales tax</span>
            <span className="block text-xs text-muted-foreground">Stripe Tax works out the right tax from the shopper&rsquo;s address.</span>
          </span>
          <Switch checked={settings.tax_enabled} disabled={off || saving || tax === "needs_setup"} onCheckedChange={(on) => toggle("tax_enabled", on)} />
        </label>
        {!off && tax === "needs_setup" && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-950 ring-1 ring-amber-200">
            Stripe Tax needs your business address first. Turn it on in your{" "}
            <a href="https://dashboard.stripe.com/settings/tax" target="_blank" rel="noreferrer" className="font-medium underline">
              Stripe dashboard
            </a>
            , then come back here.
          </p>
        )}
        {!off && tax === "active" && <p className="text-xs text-emerald-700">Stripe Tax is set up.</p>}
        {!off && tax === "unknown" && <p className="text-xs text-muted-foreground">Couldn&rsquo;t reach Stripe to check your tax setup just now.</p>}
      </div>

      {/* Promo codes */}
      <div className="space-y-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-medium">Promo codes</span>
            <span className="block text-xs text-muted-foreground">Show a &ldquo;promotion code&rdquo; box at checkout.</span>
          </span>
          <Switch checked={settings.promo_codes_enabled} disabled={off || saving} onCheckedChange={(on) => toggle("promo_codes_enabled", on)} />
        </label>
        {settings.promo_codes_enabled && (
          <p className="text-xs text-muted-foreground">
            Make codes in your Stripe dashboard under{" "}
            <a href="https://dashboard.stripe.com/coupons" target="_blank" rel="noreferrer" className="underline">
              Product catalog → Coupons
            </a>
            .
          </p>
        )}
      </div>
    </section>
  );
}
