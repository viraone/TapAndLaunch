import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ProductListBlockConfig } from "@/types/database";

/** Products themselves are managed on their own dashboard page, not here —
 * this block always shows every active product for the app (see the
 * migration comment on `products`), so there's nothing to pick. */
export function ProductListBlockEditor({
  config,
  appId,
  onChange,
}: {
  config: ProductListBlockConfig;
  appId: string;
  onChange: (config: ProductListBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="product-list-title">Title</Label>
        <Input
          id="product-list-title"
          value={config.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Shows every active product.{" "}
        <Link href={`/dashboard/apps/${appId}/products`} className="underline" target="_blank">
          Manage products
        </Link>
      </p>
    </div>
  );
}
