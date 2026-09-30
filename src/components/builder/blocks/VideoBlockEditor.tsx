import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VideoBlockConfig } from "@/types/database";

export function VideoBlockEditor({
  config,
  onChange,
}: {
  config: VideoBlockConfig;
  onChange: (config: VideoBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Provider</Label>
        <Select
          value={config.provider ?? "youtube"}
          items={{ youtube: "YouTube", vimeo: "Vimeo", embed: "Custom embed URL" }}
          onValueChange={(value) => onChange({ ...config, provider: value as VideoBlockConfig["provider"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="vimeo">Vimeo</SelectItem>
            <SelectItem value="embed">Custom embed URL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="video-url">Video URL</Label>
        <Input
          id="video-url"
          placeholder="https://…"
          value={config.url ?? ""}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
        />
      </div>
    </div>
  );
}
