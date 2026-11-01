import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WebPageBlockConfig } from "@/types/database";
import { linked } from "@/lib/builder/field-link";

/** The editor for the Web page block: the address to show, a title for screen readers, how tall it is, and location. */
export function WebPageBlockEditor({
  config,
  onChange,
}: {
  config: WebPageBlockConfig;
  organizationId: string;
  onChange: (c: WebPageBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="web-page-url">Web address</Label>
        <Input
          id="web-page-url"
          type="url"
          placeholder="https://example.com"
          {...linked("url")}
          value={config.url ?? ""}
          maxLength={2000}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
        />
        <p className="text-xs leading-relaxed text-neutral-400">
          Must start with https://. Some sites refuse to be shown inside another page; if it stays blank, link to it
          instead.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="web-page-title">Title (optional)</Label>
        <Input
          id="web-page-title"
          {...linked("title")}
          value={config.title ?? ""}
          maxLength={120}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
        <p className="text-xs text-neutral-400">For screen readers; it is not shown on the page.</p>
      </div>
      <div className="space-y-1">
        <Label>Height</Label>
        <Select
          value={config.height ?? "screen"}
          items={{ screen: "Fill the screen", tall: "Tall", short: "Short" }}
          onValueChange={(value) => onChange({ ...config, height: value as WebPageBlockConfig["height"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="screen">Fill the screen</SelectItem>
            <SelectItem value="tall">Tall</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={!!config.allow_location}
          onCheckedChange={(checked) => onChange({ ...config, allow_location: checked === true })}
        />
        <span>
          Let the page use the phone&apos;s location
          <span className="block text-xs text-neutral-400">Only if the other site asks for it.</span>
        </span>
      </label>
    </div>
  );
}
