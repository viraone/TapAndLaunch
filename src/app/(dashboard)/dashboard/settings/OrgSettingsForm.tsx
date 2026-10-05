"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadAppAsset } from "@/lib/storage/upload";
import { tileGradient, tileInitial } from "@/lib/apps/tile";
import type { Database, OrganizationBranding } from "@/types/database";
import { FIELD, LABEL, PRIMARY_BUTTON } from "./SettingsSection";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

const SWATCHES = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#a855f7", "#ef4444", "#171717"];

export function OrgSettingsForm({ organization }: { organization: OrganizationRow }) {
  const router = useRouter();
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(organization.name);
  const [branding, setBranding] = useState<OrganizationBranding>(organization.branding);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const tile = tileGradient(organization.id);
  const color = branding.primary_color ?? "";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAppAsset(supabase, organization.id, file);
      setBranding((b) => ({ ...b, logo_url: url }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, branding }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to save");
        return;
      }
      toast.success("Saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        {branding.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant-provided/storage URLs
          <img src={branding.logo_url} alt="" className="h-20 w-20 rounded-2xl border border-neutral-200 object-cover" />
        ) : (
          <span className={`grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br text-3xl font-bold text-white shadow ${tile.classes}`}>
            {tileInitial(name || organization.name)}
          </span>
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-800">Logo</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {branding.logo_url ? "Change" : "Upload"}
            </button>
            {branding.logo_url && (
              <button
                type="button"
                onClick={() => setBranding({ ...branding, logo_url: "" })}
                className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-neutral-500 transition hover:text-neutral-950"
              >
                Remove
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>

      <div>
        <label htmlFor="org-name" className={LABEL}>
          Organization name
        </label>
        <input id="org-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <span className={LABEL}>Brand color</span>
        <div className="flex flex-wrap items-center gap-1">
          {SWATCHES.map((hex) => {
            const on = color.toLowerCase() === hex;
            return (
              <button
                key={hex}
                type="button"
                aria-label={`Use ${hex}`}
                aria-pressed={on}
                onClick={() => setBranding({ ...branding, primary_color: hex })}
                className="grid h-11 w-11 place-items-center rounded-full"
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full text-white ring-offset-2 transition ${on ? "ring-2 ring-neutral-950" : "ring-1 ring-black/10"}`} style={{ background: hex }}>
                  {on && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
          <label className="relative ml-1 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200">
            <span className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: color || "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
            {color || "Custom"}
            <input
              id="org-primary-color"
              type="color"
              aria-label="Pick a custom brand color"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={color || "#6366f1"}
              onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="org-footer" className={LABEL}>
          Footer text
        </label>
        <textarea
          id="org-footer"
          rows={2}
          className={`${FIELD} h-auto py-2.5`}
          placeholder="© Your company. All rights reserved."
          value={branding.footer_text ?? ""}
          onChange={(e) => setBranding({ ...branding, footer_text: e.target.value })}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Saved now, and shown at the bottom of your pages once branded portals launch. Your logo already appears next to your name in the dashboard header.</p>
      </div>

      <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
