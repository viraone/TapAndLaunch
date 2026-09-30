import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUISINES } from "@/lib/food/cuisines";
import type { CuisineKey, FoodDirectoryBlockConfig } from "@/types/database";

/** Restaurants come from the viewer's live location (Google Places, cached
 * server-side for a day; open/closed computed live). The fallback point is
 * only used when the browser can't give a position. */
export function FoodDirectoryBlockEditor({
  config,
  onChange,
}: {
  config: FoodDirectoryBlockConfig;
  onChange: (config: FoodDirectoryBlockConfig) => void;
}) {
  const selected = new Set<CuisineKey>(config.cuisines ?? CUISINES.map((c) => c.key));

  function toggleCuisine(key: CuisineKey, on: boolean) {
    const next = CUISINES.map((c) => c.key).filter((k) => (k === key ? on : selected.has(k)));
    onChange({ ...config, cuisines: next });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="food-title">Title</Label>
        <Input id="food-title" value={config.title ?? ""} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="food-subtitle">Subtitle</Label>
        <Textarea
          id="food-subtitle"
          rows={2}
          value={config.subtitle ?? ""}
          onChange={(e) => onChange({ ...config, subtitle: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="food-radius">Radius (miles)</Label>
          <Input
            id="food-radius"
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            value={config.radius_miles ?? 2}
            onChange={(e) => onChange({ ...config, radius_miles: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label>Default sort</Label>
          <Select
            value={config.default_sort ?? "distance"}
            items={{ distance: "Nearest first", open: "Open first" }}
            onValueChange={(v) => onChange({ ...config, default_sort: (v ?? "distance") as "distance" | "open" })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="distance">Nearest first</SelectItem>
              <SelectItem value="open">Open first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cuisine quick-filters</Label>
        <div className="space-y-1.5">
          {CUISINES.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={selected.has(c.key)} onCheckedChange={(on) => toggleCuisine(c.key, on === true)} />
              <span>
                {c.emoji} {c.label}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">&ldquo;All cuisines&rdquo; is always shown first.</p>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Restaurants are found around the viewer&rsquo;s live location. This fallback is used only
          if they decline location access.
        </p>
        <div className="space-y-1">
          <Label htmlFor="food-fallback-label">Fallback area name</Label>
          <Input
            id="food-fallback-label"
            value={config.fallback_label ?? ""}
            onChange={(e) => onChange({ ...config, fallback_label: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="food-fallback-lat">Latitude</Label>
            <Input
              id="food-fallback-lat"
              type="number"
              step="0.0001"
              value={config.fallback_latitude ?? ""}
              onChange={(e) => onChange({ ...config, fallback_latitude: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="food-fallback-lng">Longitude</Label>
            <Input
              id="food-fallback-lng"
              type="number"
              step="0.0001"
              value={config.fallback_longitude ?? ""}
              onChange={(e) => onChange({ ...config, fallback_longitude: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
