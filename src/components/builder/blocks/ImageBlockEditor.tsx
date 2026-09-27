import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import type { ImageBlockConfig } from "@/types/database";

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
