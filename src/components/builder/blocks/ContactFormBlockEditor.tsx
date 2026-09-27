import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import type { ContactFormBlockConfig } from "@/types/database";

type Field = NonNullable<ContactFormBlockConfig["fields"]>[number];

export function ContactFormBlockEditor({
  config,
  onChange,
}: {
  config: ContactFormBlockConfig;
  onChange: (config: ContactFormBlockConfig) => void;
}) {
  const fields = config.fields ?? [];

  function updateField(index: number, patch: Partial<Field>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange({ ...config, fields: next });
  }

  function removeField(index: number) {
    onChange({ ...config, fields: fields.filter((_, i) => i !== index) });
  }

  function addField() {
    onChange({
      ...config,
      fields: [...fields, { name: `field_${fields.length + 1}`, label: "New field", type: "text" }],
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="form-title">Title</Label>
        <Input
          id="form-title"
          value={config.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Fields</Label>
        {fields.map((field, index) => (
          <div key={index} className="space-y-2 rounded-md border p-2">
            <div className="flex gap-2">
              <Input
                placeholder="Label"
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeField(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={field.type}
                onValueChange={(value) => updateField(index, { type: value as Field["type"] })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="textarea">Long text</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!field.required}
                  onCheckedChange={(checked) => updateField(index, { required: checked === true })}
                />
                Required
              </label>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="mr-1 h-4 w-4" /> Add field
        </Button>
      </div>

      <div className="space-y-1">
        <Label htmlFor="form-submit-label">Submit button label</Label>
        <Input
          id="form-submit-label"
          value={config.submit_label ?? ""}
          onChange={(e) => onChange({ ...config, submit_label: e.target.value })}
        />
      </div>
    </div>
  );
}
