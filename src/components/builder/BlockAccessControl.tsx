import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Mode = "public" | "members" | "custom";

function modeFor(minTier: string | null): Mode {
  if (!minTier) return "public";
  if (minTier === "*") return "members";
  return "custom";
}

/**
 * Per-block access gating (Phase 3). Deliberately not a full tier-management
 * UI — tiers are free text typed here and on a member's row in the
 * dashboard (`/dashboard/apps/[appId]/members`), matched exactly at render
 * time. See the migration comment on `blocks.min_tier` for the two reserved
 * values this maps "Public"/"Members only" to.
 */
export function BlockAccessControl({
  minTier,
  onChange,
}: {
  minTier: string | null;
  onChange: (minTier: string | null) => void;
}) {
  const [customTier, setCustomTier] = useState(modeFor(minTier) === "custom" ? (minTier ?? "") : "");
  const mode = modeFor(minTier);

  function handleModeChange(next: Mode) {
    if (next === "public") onChange(null);
    else if (next === "members") onChange("*");
    else onChange(customTier || null);
  }

  return (
    <div className="space-y-1 border-t pt-3">
      <Label>Visible to</Label>
      <Select value={mode} onValueChange={(value) => handleModeChange(value as Mode)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="public">Everyone</SelectItem>
          <SelectItem value="members">Members only</SelectItem>
          <SelectItem value="custom">Specific tier</SelectItem>
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <Input
          className="mt-1"
          placeholder="e.g. premium"
          value={customTier}
          onChange={(e) => {
            setCustomTier(e.target.value);
            onChange(e.target.value || null);
          }}
        />
      )}
    </div>
  );
}
