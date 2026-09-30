import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FuelGrade, GasDirectoryBlockConfig } from "@/types/database";

const GRADE_LABELS: Record<FuelGrade, string> = {
  regular: "Regular",
  midgrade: "Midgrade",
  premium: "Premium",
  diesel: "Diesel",
};

/** Stations come from the viewer's live location (Google Places, cached
 * server-side). The fallback point is only used when the browser can't give
 * a position — it is not the search center. */
export function GasDirectoryBlockEditor({
  config,
  onChange,
}: {
  config: GasDirectoryBlockConfig;
  onChange: (config: GasDirectoryBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="gas-title">Title</Label>
        <Input id="gas-title" value={config.title ?? ""} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="gas-radius">Radius (miles)</Label>
          <Input
            id="gas-radius"
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
            value={config.default_sort ?? "price"}
            items={{ price: "Price (low to high)", distance: "Distance (nearest)" }}
            onValueChange={(v) => onChange({ ...config, default_sort: (v ?? "price") as "price" | "distance" })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price">Price (low to high)</SelectItem>
              <SelectItem value="distance">Distance (nearest)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Default fuel grade</Label>
        <Select
          value={config.default_grade ?? "regular"}
          items={GRADE_LABELS}
          onValueChange={(v) => onChange({ ...config, default_grade: (v ?? "regular") as FuelGrade })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(GRADE_LABELS) as FuelGrade[]).map((g) => (
              <SelectItem key={g} value={g}>
                {GRADE_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Stations are found around the viewer&rsquo;s live location. This fallback is used only if
          they decline location access.
        </p>
        <div className="space-y-1">
          <Label htmlFor="gas-fallback-label">Fallback area name</Label>
          <Input
            id="gas-fallback-label"
            value={config.fallback_label ?? ""}
            onChange={(e) => onChange({ ...config, fallback_label: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="gas-fallback-lat">Latitude</Label>
            <Input
              id="gas-fallback-lat"
              type="number"
              step="0.0001"
              value={config.fallback_latitude ?? ""}
              onChange={(e) => onChange({ ...config, fallback_latitude: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gas-fallback-lng">Longitude</Label>
            <Input
              id="gas-fallback-lng"
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
