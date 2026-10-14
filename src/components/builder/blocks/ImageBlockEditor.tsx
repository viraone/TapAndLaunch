import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { linked } from "@/lib/builder/field-link";
import type { ImageBlockConfig } from "@/types/database";

const FOCUS: Record<string, string> = { center: "The middle", top: "The top", bottom: "The bottom", left: "The left side", right: "The right side" };

export function ImageBlockEditor({
  config,
  organizationId,
  onChange,
}: {
  config: ImageBlockConfig;
  organizationId: string;
  onChange: (config: ImageBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <ImageUploadField
        id="image-src"
        label="Image"
        organizationId={organizationId}
        value={config.src ?? ""}
        onChange={(src) => onChange({ ...config, src })}
      />
      <div className="space-y-1">
        <Label htmlFor="image-caption">Caption (optional)</Label>
        <Input id="image-caption" {...linked("caption")} value={config.caption ?? ""} maxLength={200} onChange={(e) => onChange({ ...config, caption: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Keep in view when cropped</Label>
        <Select value={config.focus ?? "center"} items={FOCUS} onValueChange={(v) => onChange({ ...config, focus: (v ?? "center") as ImageBlockConfig["focus"] })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FOCUS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="image-alt">Describe the picture (for people who can&apos;t see it, and for search)</Label>
        <Input id="image-alt" value={config.alt ?? ""} maxLength={200} onChange={(e) => onChange({ ...config, alt: e.target.value })} />
      </div>
    </div>
  );
}
