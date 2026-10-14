import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import { FileUploadField } from "@/components/builder/FileUploadField";
import { linked } from "@/lib/builder/field-link";
import type { AudioBlockConfig, ImageTextBlockConfig, MapBlockConfig, NewsletterBlockConfig, ShareBlockConfig } from "@/types/database";

/** Editors for the Picture & words, Newsletter, Share, Map and Audio sections. */

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function ImageTextBlockEditor({ config, organizationId, pages = [], onChange }: { config: ImageTextBlockConfig; organizationId: string; pages?: Array<{ path: string; name: string }>; onChange: (c: ImageTextBlockConfig) => void }) {
  const toWeb = !!config.button_url?.trim();
  return (
    <div className="space-y-3">
      <ImageUploadField id="it-image" label="Photo" organizationId={organizationId} value={config.image_url ?? ""} onChange={(image_url) => onChange({ ...config, image_url })} />
      <div className="space-y-1">
        <Label>Photo on the</Label>
        <Select value={config.side ?? "left"} items={{ left: "Left", right: "Right" }} onValueChange={(v) => onChange({ ...config, side: (v ?? "left") as ImageTextBlockConfig["side"] })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field id="it-heading" label="Heading">
        <Input id="it-heading" {...linked("heading")} value={config.heading ?? ""} maxLength={80} onChange={(e) => onChange({ ...config, heading: e.target.value })} />
      </Field>
      <Field id="it-body" label="Words">
        <Textarea id="it-body" {...linked("body")} rows={4} value={config.body ?? ""} maxLength={2000} onChange={(e) => onChange({ ...config, body: e.target.value })} />
      </Field>
      <Field id="it-button" label="Button text (leave empty for no button)">
        <Input id="it-button" {...linked("button_label")} value={config.button_label ?? ""} maxLength={30} onChange={(e) => onChange({ ...config, button_label: e.target.value })} />
      </Field>
      <div className="space-y-1">
        <Label>The button opens</Label>
        <Select
          value={toWeb ? "web" : (config.button_page ?? "")}
          items={{ "": "Nothing yet", web: "A web address", ...Object.fromEntries(pages.map((p) => [p.path, p.name])) }}
          onValueChange={(value) => (value === "web" ? onChange({ ...config, button_page: "", button_url: config.button_url || "https://" }) : onChange({ ...config, button_page: value ?? "", button_url: "" }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nothing yet</SelectItem>
            <SelectItem value="web">A web address</SelectItem>
            {pages.map((p) => (
              <SelectItem key={p.path} value={p.path}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {toWeb && (
        <Field id="it-url" label="Web address">
          <Input id="it-url" type="url" value={config.button_url ?? ""} onChange={(e) => onChange({ ...config, button_url: e.target.value })} />
        </Field>
      )}
      <Field id="it-alt" label="Describe the photo (for people who can't see it)">
        <Input id="it-alt" value={config.alt ?? ""} maxLength={200} onChange={(e) => onChange({ ...config, alt: e.target.value })} />
      </Field>
    </div>
  );
}

export function NewsletterBlockEditor({ config, onChange }: { config: NewsletterBlockConfig; onChange: (c: NewsletterBlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field id="nl-title" label="Title">
        <Input id="nl-title" {...linked("title")} value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      <Field id="nl-intro" label="A line under the title (optional)">
        <Input id="nl-intro" {...linked("intro")} value={config.intro ?? ""} maxLength={160} onChange={(e) => onChange({ ...config, intro: e.target.value })} />
      </Field>
      <Field id="nl-button" label="Button text">
        <Input id="nl-button" {...linked("button_label")} value={config.button_label ?? ""} maxLength={30} placeholder="Sign up" onChange={(e) => onChange({ ...config, button_label: e.target.value })} />
      </Field>
      <Field id="nl-success" label="After they sign up">
        <Input id="nl-success" {...linked("success")} value={config.success ?? ""} maxLength={120} placeholder="You're on the list." onChange={(e) => onChange({ ...config, success: e.target.value })} />
      </Field>
      <p className="text-xs text-muted-foreground">People who sign up appear under Members. Write to them from Notifications, Email.</p>
    </div>
  );
}

export function ShareBlockEditor({ config, onChange }: { config: ShareBlockConfig; onChange: (c: ShareBlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field id="share-title" label="Title">
        <Input id="share-title" {...linked("title")} value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      <p className="text-xs text-muted-foreground">Visitors get Share, Copy link, X, Facebook, WhatsApp and Email, all pointing at the page they are on.</p>
    </div>
  );
}

export function MapBlockEditor({ config, onChange }: { config: MapBlockConfig; onChange: (c: MapBlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field id="map-title" label="Title (optional)">
        <Input id="map-title" {...linked("title")} value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      <Field id="map-address" label="Address">
        <Input id="map-address" {...linked("address")} value={config.address ?? ""} maxLength={200} placeholder="200 S Tobin St, Renton, WA 98057" onChange={(e) => onChange({ ...config, address: e.target.value })} />
      </Field>
    </div>
  );
}

export function AudioBlockEditor({ config, organizationId, onChange }: { config: AudioBlockConfig; organizationId: string; onChange: (c: AudioBlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <FileUploadField id="audio-src" label="Audio file (MP3, M4A, WAV)" organizationId={organizationId} value={config.src ?? ""} onChange={(src, name) => onChange({ ...config, src, title: config.title || (name ? name.replace(/\.[a-z0-9]+$/i, "") : "") })} />
      <Field id="audio-title" label="What this is">
        <Input id="audio-title" {...linked("title")} value={config.title ?? ""} maxLength={80} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      <Field id="audio-note" label="A line about it (optional)">
        <Input id="audio-note" {...linked("note")} value={config.note ?? ""} maxLength={160} onChange={(e) => onChange({ ...config, note: e.target.value })} />
      </Field>
    </div>
  );
}
