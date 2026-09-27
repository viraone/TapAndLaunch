"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import type { Database, OrganizationBranding } from "@/types/database";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export function OrgSettingsForm({ organization }: { organization: OrganizationRow }) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [branding, setBranding] = useState<OrganizationBranding>(organization.branding);
  const [saving, setSaving] = useState(false);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="org-name">Organization name</Label>
        <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <ImageUploadField
        id="org-logo"
        label="Logo"
        organizationId={organization.id}
        value={branding.logo_url ?? ""}
        onChange={(logo_url) => setBranding({ ...branding, logo_url })}
      />

      <div className="space-y-1">
        <Label htmlFor="org-primary-color">Brand color</Label>
        <Input
          id="org-primary-color"
          type="color"
          value={branding.primary_color ?? "#000000"}
          onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="org-footer">Footer text</Label>
        <Textarea
          id="org-footer"
          rows={2}
          placeholder="© Your Agency. All rights reserved."
          value={branding.footer_text ?? ""}
          onChange={(e) => setBranding({ ...branding, footer_text: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Not yet shown anywhere — a fully white-labeled reseller portal (its own domain,
          fully re-skinned) is a later phase; this saves the value for when it exists. The
          logo above already appears next to your org name in the dashboard header.
        </p>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
