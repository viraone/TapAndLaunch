"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import type { Database } from "@/types/database";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

function dollarsToCents(value: string): number {
  return Math.round(Number(value || "0") * 100);
}
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function NewProductForm({
  appId,
  organizationId,
  onCreated,
}: {
  appId: string;
  organizationId: string;
  onCreated: (product: ProductRow) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          price_cents: dollarsToCents(price),
          image_url: imageUrl || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to create product");
        return;
      }
      onCreated(body.product);
      setName("");
      setDescription("");
      setPrice("");
      setImageUrl("");
      toast.success("Product added");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Add product</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="new-product-name">Name</Label>
          <Input id="new-product-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-product-price">Price (USD)</Label>
          <Input
            id="new-product-price"
            type="number"
            min="0"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-product-description">Description</Label>
        <Textarea id="new-product-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <ImageUploadField
        id="new-product-image"
        label="Image"
        organizationId={organizationId}
        value={imageUrl}
        onChange={setImageUrl}
      />
      <Button type="submit" disabled={saving}>
        {saving ? "Adding…" : "Add product"}
      </Button>
    </form>
  );
}

function ProductRowEditor({
  appId,
  organizationId,
  product,
  onUpdated,
  onDeleted,
}: {
  appId: string;
  organizationId: string;
  product: ProductRow;
  onUpdated: (product: ProductRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(centsToDollars(product.price_cents));
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const [isActive, setIsActive] = useState(product.is_active);
  const [saving, setSaving] = useState(false);

  async function save(patch: Partial<ProductRow>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to update product");
        return;
      }
      onUpdated(body.product);
      toast.success("Saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Failed to delete product");
        return;
      }
      onDeleted(product.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <ImageUploadField id={`product-image-${product.id}`} label="Image" organizationId={organizationId} value={imageUrl} onChange={setImageUrl} />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => {
              setIsActive(checked);
              save({ is_active: checked });
            }}
          />
          Active
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => save({ name, price_cents: dollarsToCents(price), image_url: imageUrl || null })}
          >
            Save
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={saving} onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProductsManager({
  appId,
  organizationId,
  initialProducts,
}: {
  appId: string;
  organizationId: string;
  initialProducts: ProductRow[];
}) {
  const [products, setProducts] = useState(initialProducts);

  return (
    <div className="space-y-4">
      <NewProductForm
        appId={appId}
        organizationId={organizationId}
        onCreated={(product) => setProducts((prev) => [product, ...prev])}
      />
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <ProductRowEditor
              key={product.id}
              appId={appId}
              organizationId={organizationId}
              product={product}
              onUpdated={(updated) => setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
              onDeleted={(id) => setProducts((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
