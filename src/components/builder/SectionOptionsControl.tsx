import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const APPEARANCE: Record<string, string> = { plain: "Plain", tinted: "Tinted", accent: "A wash of your colour" };
const SHOW_ON: Record<string, string> = { all: "Phones and computers", phone: "Phones only", desktop: "Computers only" };

/** The looks every section has: a background, and which screens show it. Stored on the section's config. */
export function SectionOptionsControl({ config, onChange }: { config: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  const appearance = typeof config.appearance === "string" ? config.appearance : "plain";
  const showOn = typeof config.show_on === "string" ? config.show_on : "all";
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Background</Label>
        <Select value={appearance} items={APPEARANCE} onValueChange={(v) => onChange({ ...config, appearance: v ?? "plain" })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(APPEARANCE).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Show on</Label>
        <Select value={showOn} items={SHOW_ON} onValueChange={(v) => onChange({ ...config, show_on: v ?? "all" })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SHOW_ON).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
