"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function NewAppForm({ organizationId, rootDomain }: { organizationId: string; rootDomain: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, name, slug: slugify(name) }),
    });
    const body = await res.json();

    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }

    router.push(`/dashboard/apps/${body.app.id}/builder`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="app-name">App name</Label>
        <Input id="app-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="My Store" />
        {name.trim() && (
          <p className="text-xs text-muted-foreground">
            Will be published at {slugify(name)}.{rootDomain}
          </p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || !name.trim()}>
        {loading ? "Creating…" : "Create app"}
      </Button>
    </form>
  );
}
