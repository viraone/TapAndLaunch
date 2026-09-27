import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CanvaEmbedBlockConfig } from "@/types/database";

/** No Canva API integration — an embed iframe (from Canva's own "Share >
 * Embed" link) and/or a button linking out to a design, same as the video
 * block's embed-URL approach. */
export function CanvaEmbedBlockEditor({
  config,
  onChange,
}: {
  config: CanvaEmbedBlockConfig;
  onChange: (config: CanvaEmbedBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="canva-embed-url">Embed URL</Label>
        <Input
          id="canva-embed-url"
          placeholder="https://www.canva.com/design/.../view?embed"
          value={config.embed_url ?? ""}
          onChange={(e) => onChange({ ...config, embed_url: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="canva-button-label">Button label</Label>
        <Input
          id="canva-button-label"
          placeholder="Open in Canva"
          value={config.button_label ?? ""}
          onChange={(e) => onChange({ ...config, button_label: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="canva-button-url">Button URL</Label>
        <Input
          id="canva-button-url"
          placeholder="https://www.canva.com/design/..."
          value={config.button_url ?? ""}
          onChange={(e) => onChange({ ...config, button_url: e.target.value })}
        />
      </div>
    </div>
  );
}
