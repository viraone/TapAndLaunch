import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ZoomMeetingBlockConfig } from "@/types/database";

/** A meeting-link embed, not a Zoom API integration — creating/managing the
 * meeting itself still happens in Zoom; this just links to it. */
export function ZoomMeetingBlockEditor({
  config,
  onChange,
}: {
  config: ZoomMeetingBlockConfig;
  onChange: (config: ZoomMeetingBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="zoom-title">Title</Label>
        <Input
          id="zoom-title"
          value={config.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="zoom-description">Description</Label>
        <Textarea
          id="zoom-description"
          rows={2}
          value={config.description ?? ""}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="zoom-url">Meeting URL</Label>
        <Input
          id="zoom-url"
          placeholder="https://zoom.us/j/..."
          value={config.meeting_url ?? ""}
          onChange={(e) => onChange({ ...config, meeting_url: e.target.value })}
        />
      </div>
    </div>
  );
}
