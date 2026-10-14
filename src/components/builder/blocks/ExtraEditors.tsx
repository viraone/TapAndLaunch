import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { linked } from "@/lib/builder/field-link";
import type { ButtonBlockConfig, FaqBlockConfig, QuoteBlockConfig } from "@/types/database";

/** Editors for the Button, Quote and Questions sections. */

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

const BUTTON_STYLES: Record<string, string> = { primary: "Filled", outline: "Outlined", soft: "Soft" };
const ALIGN: Record<string, string> = { center: "Centered", left: "Left", right: "Right" };

export function ButtonBlockEditor({ config, pages = [], onChange }: { config: ButtonBlockConfig; pages?: Array<{ path: string; name: string }>; onChange: (c: ButtonBlockConfig) => void }) {
  const toWeb = !!config.url?.trim();
  return (
    <div className="space-y-3">
      <Field id="btn-label" label="Button text">
        <Input id="btn-label" {...linked("label")} value={config.label ?? ""} maxLength={40} onChange={(e) => onChange({ ...config, label: e.target.value })} />
      </Field>
      <div className="space-y-1">
        <Label>It opens</Label>
        <Select
          value={toWeb ? "web" : (config.page ?? "")}
          items={{ "": "Nothing yet", web: "A web address", ...Object.fromEntries(pages.map((p) => [p.path, `${p.name} (a page of this app)`])) }}
          onValueChange={(value) => (value === "web" ? onChange({ ...config, page: "", url: config.url || "https://" }) : onChange({ ...config, page: value ?? "", url: "" }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nothing yet</SelectItem>
            <SelectItem value="web">A web address</SelectItem>
            {pages.map((p) => (
              <SelectItem key={p.path} value={p.path}>
                {p.name} (a page of this app)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {toWeb && (
        <Field id="btn-url" label="Web address">
          <Input id="btn-url" type="url" placeholder="https://www.eventbrite.com/…" value={config.url ?? ""} onChange={(e) => onChange({ ...config, url: e.target.value })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Look</Label>
          <Select value={config.style ?? "primary"} items={BUTTON_STYLES} onValueChange={(v) => onChange({ ...config, style: (v ?? "primary") as ButtonBlockConfig["style"] })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BUTTON_STYLES).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Placed</Label>
          <Select value={config.align ?? "center"} items={ALIGN} onValueChange={(v) => onChange({ ...config, align: (v ?? "center") as ButtonBlockConfig["align"] })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ALIGN).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export function QuoteBlockEditor({ config, onChange }: { config: QuoteBlockConfig; onChange: (c: QuoteBlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <Field id="quote-text" label="The quote">
        <Textarea id="quote-text" {...linked("quote")} rows={3} value={config.quote ?? ""} maxLength={400} onChange={(e) => onChange({ ...config, quote: e.target.value })} />
      </Field>
      <Field id="quote-name" label="Who said it">
        <Input id="quote-name" {...linked("name")} value={config.name ?? ""} maxLength={80} onChange={(e) => onChange({ ...config, name: e.target.value })} />
      </Field>
    </div>
  );
}

export function FaqBlockEditor({ config, onChange }: { config: FaqBlockConfig; onChange: (c: FaqBlockConfig) => void }) {
  const items = config.items ?? [];
  const setItem = (i: number, item: (typeof items)[number]) => onChange({ ...config, items: items.map((x, j) => (j === i ? item : x)) });
  return (
    <div className="space-y-3">
      <Field id="faq-title" label="Title">
        <Input id="faq-title" {...linked("title")} value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </Field>
      {items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
          <div className="flex items-start gap-2">
            <Input aria-label="Question" placeholder="Question" {...linked(["items", i, "question"])} value={item.question} maxLength={160} onChange={(e) => setItem(i, { ...item, question: e.target.value })} />
            <button type="button" aria-label="Remove this question" onClick={() => onChange({ ...config, items: items.filter((_, j) => j !== i) })} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-red-300">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <Textarea aria-label="Answer" placeholder="Answer" rows={2} {...linked(["items", i, "answer"])} value={item.answer} maxLength={1200} onChange={(e) => setItem(i, { ...item, answer: e.target.value })} />
        </div>
      ))}
      {items.length < 20 && (
        <button type="button" onClick={() => onChange({ ...config, items: [...items, { question: "", answer: "" }] })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-neutral-100 transition hover:bg-white/15">
          <Plus className="h-3.5 w-3.5" /> Add a question
        </button>
      )}
    </div>
  );
}
