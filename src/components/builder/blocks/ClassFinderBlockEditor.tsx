import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CLASS_TYPES } from "@/lib/fitness/schedule";
import type { ClassFinderBlockConfig, FitnessClassType } from "@/types/database";

/** Studios and their classes come from the morning job on the owner's Mac (tools/class-ingest); here you only choose
 * the wording, the area name used for distances, and which class types to offer. */
export function ClassFinderBlockEditor({
  config,
  onChange,
}: {
  config: ClassFinderBlockConfig;
  onChange: (config: ClassFinderBlockConfig) => void;
}) {
  const selected = new Set<FitnessClassType>(config.class_types ?? CLASS_TYPES.map((t) => t.key));

  function toggle(key: FitnessClassType, on: boolean) {
    onChange({ ...config, class_types: CLASS_TYPES.map((t) => t.key).filter((k) => (k === key ? on : selected.has(k))) });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="classes-title">Title</Label>
        <Input id="classes-title" value={config.title ?? ""} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="classes-subtitle">Subtitle</Label>
        <Textarea id="classes-subtitle" rows={2} value={config.subtitle ?? ""} onChange={(e) => onChange({ ...config, subtitle: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="classes-area">Area name</Label>
        <Input id="classes-area" value={config.area_label ?? ""} onChange={(e) => onChange({ ...config, area_label: e.target.value })} />
        <p className="text-xs text-muted-foreground">Shown as &ldquo;Near …&rdquo;. Distances are from here until a viewer shares their location.</p>
      </div>
      <div className="space-y-2">
        <Label>Class types</Label>
        {CLASS_TYPES.map((t) => (
          <label key={t.key} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.has(t.key)} onCheckedChange={(v) => toggle(t.key, v === true)} />
            {t.label}
          </label>
        ))}
      </div>
    </div>
  );
}
