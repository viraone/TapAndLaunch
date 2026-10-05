import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/builder/ImageUploadField";
import type { GalleryBlockConfig, HeroBlockConfig, HoursBlockConfig, PriceListBlockConfig, ReviewsBlockConfig, StatsBlockConfig } from "@/types/database";

/** Editors for the showcase blocks (banner, menu & prices, hours, reviews, highlights, gallery). */

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-neutral-100 transition hover:bg-white/15"
    >
      <Plus className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-red-300"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

const Card = ({ children }: { children: React.ReactNode }) => <div className="space-y-2 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">{children}</div>;

const replaceAt = <T,>(list: T[], i: number, value: T) => list.map((x, j) => (j === i ? value : x));
const removeAt = <T,>(list: T[], i: number) => list.filter((_, j) => j !== i);

export function HeroBlockEditor({ config, organizationId, onChange }: { config: HeroBlockConfig; organizationId: string; onChange: (c: HeroBlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <ImageUploadField id="hero-image" label="Background photo" organizationId={organizationId} value={config.image_url ?? ""} onChange={(image_url) => onChange({ ...config, image_url })} />
      <Field id="hero-eyebrow" label="Small label above (optional)">
        <Input id="hero-eyebrow" value={config.eyebrow ?? ""} maxLength={40} onChange={(e) => onChange({ ...config, eyebrow: e.target.value })} />
      </Field>
      <Field id="hero-headline" label="Headline">
        <Input id="hero-headline" value={config.headline ?? ""} maxLength={80} onChange={(e) => onChange({ ...config, headline: e.target.value })} />
      </Field>
      <Field id="hero-subtext" label="Line under the headline">
        <Textarea id="hero-subtext" rows={2} value={config.subtext ?? ""} maxLength={200} onChange={(e) => onChange({ ...config, subtext: e.target.value })} />
      </Field>
      <Field id="hero-button" label="Button text (leave empty for no button)">
        <Input id="hero-button" value={config.button_label ?? ""} maxLength={30} onChange={(e) => onChange({ ...config, button_label: e.target.value })} />
      </Field>
      <Field id="hero-page" label="Button opens page (its address, like classes)">
        <Input id="hero-page" value={config.button_page ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, button_page: e.target.value.replace(/^\/+/, "") })} />
      </Field>
    </div>
  );
}

export function StatsBlockEditor({ config, onChange }: { config: StatsBlockConfig; onChange: (c: StatsBlockConfig) => void }) {
  const items = config.items ?? [];
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <Card key={i}>
          <div className="flex items-start gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Input aria-label="Value" placeholder="4.9★" value={item.value} maxLength={12} onChange={(e) => onChange({ ...config, items: replaceAt(items, i, { ...item, value: e.target.value }) })} />
              <Input aria-label="Label" placeholder="Rating" value={item.label} maxLength={24} onChange={(e) => onChange({ ...config, items: replaceAt(items, i, { ...item, label: e.target.value }) })} />
            </div>
            <RemoveButton label="Remove this fact" onClick={() => onChange({ ...config, items: removeAt(items, i) })} />
          </div>
        </Card>
      ))}
      {items.length < 4 && <AddButton onClick={() => onChange({ ...config, items: [...items, { value: "", label: "" }] })}>Add a fact</AddButton>}
    </div>
  );
}

export function PriceListBlockEditor({ config, onChange }: { config: PriceListBlockConfig; onChange: (c: PriceListBlockConfig) => void }) {
  const sections = config.sections ?? [];
  const setSection = (i: number, s: (typeof sections)[number]) => onChange({ ...config, sections: replaceAt(sections, i, s) });
  return (
    <div className="space-y-3">
      <Field id="pl-title" label="Title">
        <Input id="pl-title" value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      <Field id="pl-subtitle" label="Line under the title (optional)">
        <Input id="pl-subtitle" value={config.subtitle ?? ""} maxLength={120} onChange={(e) => onChange({ ...config, subtitle: e.target.value })} />
      </Field>
      {sections.map((section, si) => (
        <Card key={si}>
          <div className="flex items-center gap-2">
            <Input aria-label="Section name" placeholder="Section, like Mains" value={section.name} maxLength={40} onChange={(e) => setSection(si, { ...section, name: e.target.value })} />
            <RemoveButton label="Remove this section" onClick={() => onChange({ ...config, sections: removeAt(sections, si) })} />
          </div>
          {section.items.map((item, ii) => (
            <div key={ii} className="space-y-1.5 border-t border-white/10 pt-2">
              <div className="flex items-center gap-2">
                <Input aria-label="Item name" placeholder="Name" value={item.name} maxLength={60} onChange={(e) => setSection(si, { ...section, items: replaceAt(section.items, ii, { ...item, name: e.target.value }) })} />
                <Input aria-label="Price" placeholder="$12" className="w-24" value={item.price ?? ""} maxLength={16} onChange={(e) => setSection(si, { ...section, items: replaceAt(section.items, ii, { ...item, price: e.target.value }) })} />
                <RemoveButton label="Remove this item" onClick={() => setSection(si, { ...section, items: removeAt(section.items, ii) })} />
              </div>
              <Input aria-label="Description" placeholder="Short description (optional)" value={item.description ?? ""} maxLength={140} onChange={(e) => setSection(si, { ...section, items: replaceAt(section.items, ii, { ...item, description: e.target.value }) })} />
              <Input aria-label="Badge" placeholder="Badge, like Popular (optional)" value={item.badge ?? ""} maxLength={20} onChange={(e) => setSection(si, { ...section, items: replaceAt(section.items, ii, { ...item, badge: e.target.value }) })} />
            </div>
          ))}
          <AddButton onClick={() => setSection(si, { ...section, items: [...section.items, { name: "", price: "" }] })}>Add an item</AddButton>
        </Card>
      ))}
      <AddButton onClick={() => onChange({ ...config, sections: [...sections, { name: "", items: [{ name: "", price: "" }] }] })}>Add a section</AddButton>
    </div>
  );
}

export function HoursBlockEditor({ config, onChange }: { config: HoursBlockConfig; onChange: (c: HoursBlockConfig) => void }) {
  const rows = config.rows ?? [];
  return (
    <div className="space-y-3">
      <Field id="hours-title" label="Title">
        <Input id="hours-title" value={config.title ?? ""} maxLength={40} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input aria-label="Days" placeholder="Mon to Fri" value={row.label} maxLength={30} onChange={(e) => onChange({ ...config, rows: replaceAt(rows, i, { ...row, label: e.target.value }) })} />
          <Input aria-label="Hours" placeholder="9am to 6pm" value={row.value} maxLength={40} onChange={(e) => onChange({ ...config, rows: replaceAt(rows, i, { ...row, value: e.target.value }) })} />
          <RemoveButton label="Remove this row" onClick={() => onChange({ ...config, rows: removeAt(rows, i) })} />
        </div>
      ))}
      <AddButton onClick={() => onChange({ ...config, rows: [...rows, { label: "", value: "" }] })}>Add a row</AddButton>
      <Field id="hours-address" label="Address (shows a Directions button)">
        <Input id="hours-address" value={config.address ?? ""} maxLength={160} onChange={(e) => onChange({ ...config, address: e.target.value })} />
      </Field>
      <Field id="hours-phone" label="Phone (shows a Call button)">
        <Input id="hours-phone" type="tel" value={config.phone ?? ""} maxLength={30} onChange={(e) => onChange({ ...config, phone: e.target.value })} />
      </Field>
    </div>
  );
}

export function ReviewsBlockEditor({ config, onChange }: { config: ReviewsBlockConfig; onChange: (c: ReviewsBlockConfig) => void }) {
  const items = config.items ?? [];
  return (
    <div className="space-y-3">
      <Field id="rev-title" label="Title">
        <Input id="rev-title" value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      {items.map((item, i) => (
        <Card key={i}>
          <div className="flex items-start gap-2">
            <Textarea aria-label="Quote" rows={3} value={item.quote} maxLength={280} onChange={(e) => onChange({ ...config, items: replaceAt(items, i, { ...item, quote: e.target.value }) })} />
            <RemoveButton label="Remove this review" onClick={() => onChange({ ...config, items: removeAt(items, i) })} />
          </div>
          <div className="flex items-center gap-2">
            <Input aria-label="Name" placeholder="Name" value={item.name} maxLength={40} onChange={(e) => onChange({ ...config, items: replaceAt(items, i, { ...item, name: e.target.value }) })} />
            <select
              aria-label="Stars"
              value={item.rating ?? 5}
              onChange={(e) => onChange({ ...config, items: replaceAt(items, i, { ...item, rating: Number(e.target.value) }) })}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}★
                </option>
              ))}
            </select>
          </div>
        </Card>
      ))}
      <AddButton onClick={() => onChange({ ...config, items: [...items, { quote: "", name: "", rating: 5 }] })}>Add a review</AddButton>
    </div>
  );
}

export function GalleryBlockEditor({ config, organizationId, onChange }: { config: GalleryBlockConfig; organizationId: string; onChange: (c: GalleryBlockConfig) => void }) {
  const images = config.images ?? [];
  return (
    <div className="space-y-3">
      <Field id="gal-title" label="Title (optional)">
        <Input id="gal-title" value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      {images.map((img, i) => (
        <Card key={i}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ImageUploadField id={`gal-${i}`} label={`Photo ${i + 1}`} organizationId={organizationId} value={img.src} onChange={(src) => onChange({ ...config, images: replaceAt(images, i, { ...img, src }) })} />
            </div>
            <RemoveButton label="Remove this photo" onClick={() => onChange({ ...config, images: removeAt(images, i) })} />
          </div>
          <Input aria-label="Describe the photo" placeholder="Describe the photo (for screen readers)" value={img.alt ?? ""} maxLength={120} onChange={(e) => onChange({ ...config, images: replaceAt(images, i, { ...img, alt: e.target.value }) })} />
        </Card>
      ))}
      {images.length < 9 && <AddButton onClick={() => onChange({ ...config, images: [...images, { src: "", alt: "" }] })}>Add a photo</AddButton>}
    </div>
  );
}
