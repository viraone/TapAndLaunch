import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ImageBlockConfig } from "@/types/database";

// Phase 1 takes an image URL directly rather than a file upload — Supabase
// Storage integration (drag-and-drop upload, tenant-scoped buckets) is
// deferred; see the README's phase notes.
export function ImageBlockEditor({
  config,
  onChange,
}: {
  config: ImageBlockConfig;
  onChange: (config: ImageBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="image-src">Image URL</Label>
        <Input
          id="image-src"
          placeholder="https://…"
          value={config.src ?? ""}
          onChange={(e) => onChange({ ...config, src: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="image-alt">Alt text</Label>
        <Input
          id="image-alt"
          value={config.alt ?? ""}
          onChange={(e) => onChange({ ...config, alt: e.target.value })}
        />
      </div>
    </div>
  );
}
