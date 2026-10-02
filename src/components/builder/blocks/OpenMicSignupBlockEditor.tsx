import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { OpenMicSignupBlockConfig } from "@/types/database";

/** Requests are stored in the show's own Supabase project, so this block
 * needs that project's URL and public (anon / publishable) key. The request
 * window is shown, not edited: it matches the weekly reset job over there. */
export function OpenMicSignupBlockEditor({
  config,
  onChange,
}: {
  config: OpenMicSignupBlockConfig;
  onChange: (config: OpenMicSignupBlockConfig) => void;
}) {
  const text = (key: "title" | "show_name" | "venue" | "show_time" | "logo_url" | "lineup_url" | "supabase_url" | "anon_key", label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`open-mic-${key}`}>{label}</Label>
      <Input
        id={`open-mic-${key}`}
        value={config[key] ?? ""}
        onChange={(e) => onChange({ ...config, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {text("title", "Title")}
      {text("show_name", "Show name")}
      {text("venue", "Venue")}
      {text("show_time", "Show time")}
      {text("logo_url", "Logo image URL")}
      {text("lineup_url", "Lineup feed URL")}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.show_lineup !== false}
          onChange={(e) => onChange({ ...config, show_lineup: e.target.checked })}
        />
        Show the lineup to signed-in comics on show day (from 6 AM)
      </label>
      {text("supabase_url", "Supabase project URL")}
      {text("anon_key", "Supabase public key")}
      <p className="text-xs text-muted-foreground">
        Requests open Friday 9:40 PM and close Thursday 10:00 PM ({config.time_zone ?? "America/Los_Angeles"}).
      </p>
    </div>
  );
}
