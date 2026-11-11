import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { VoiceChatBlockConfig } from "@/types/database";
import { linked } from "@/lib/builder/field-link";

/** The editor for the Voice chat block: the words around the button, which Lao voice answers, and what the assistant is for. */
export function VoiceChatBlockEditor({ config, onChange }: { config: VoiceChatBlockConfig; onChange: (c: VoiceChatBlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="voice-title">Title</Label>
        <Input id="voice-title" {...linked("title")} value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="voice-intro">A line under the title (optional)</Label>
        <Textarea id="voice-intro" {...linked("intro")} rows={2} value={config.intro ?? ""} maxLength={200} onChange={(e) => onChange({ ...config, intro: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="voice-greeting">First message, in Lao (optional)</Label>
        <Textarea id="voice-greeting" rows={2} value={config.greeting ?? ""} maxLength={200} onChange={(e) => onChange({ ...config, greeting: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="voice-voice">Voice</Label>
        <select
          id="voice-voice"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={config.voice ?? "keomany"}
          onChange={(e) => onChange({ ...config, voice: e.target.value === "chanthavong" ? "chanthavong" : "keomany" })}
        >
          <option value="keomany">Keomany (woman)</option>
          <option value="chanthavong">Chanthavong (man)</option>
        </select>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" checked={!!config.hands_free} onCheckedChange={(checked) => onChange({ ...config, hands_free: checked === true })} />
        <span>
          Keep listening after each reply
          <span className="block text-xs text-neutral-400">One tap starts a whole conversation: the microphone opens again when the reply ends, and closes by itself when nobody talks.</span>
        </span>
      </label>
      <div className="space-y-1">
        <Label htmlFor="voice-persona">What should it help with? (optional)</Label>
        <Textarea
          id="voice-persona"
          rows={4}
          value={config.persona ?? ""}
          maxLength={1500}
          placeholder="For example: You answer questions about our noodle shop. We are open 11 to 9 and closed on Mondays."
          onChange={(e) => onChange({ ...config, persona: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">It always answers in Lao, in short sentences.</p>
      </div>
    </div>
  );
}
