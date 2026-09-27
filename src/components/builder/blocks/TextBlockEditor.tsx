import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TextBlockConfig } from "@/types/database";

export function TextBlockEditor({
  config,
  onChange,
}: {
  config: TextBlockConfig;
  onChange: (config: TextBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="text-heading">Heading</Label>
        <Input
          id="text-heading"
          value={config.heading ?? ""}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="text-body">Body</Label>
        <Textarea
          id="text-body"
          rows={5}
          value={config.body ?? ""}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
        />
      </div>
    </div>
  );
}
