import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TextBlockConfig } from "@/types/database";
import { linked } from "@/lib/builder/field-link";

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
          {...linked("heading")}
          value={config.heading ?? ""}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="text-body">Body</Label>
        <Textarea
          id="text-body"
          {...linked("body")}
          rows={5}
          value={config.body ?? ""}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Easier on the page: click the words there and use the bar for bold, italic, links and bullets. Here, **bold**, _italic_, [words](https://…) and lines starting with - work too.</p>
      </div>
    </div>
  );
}
