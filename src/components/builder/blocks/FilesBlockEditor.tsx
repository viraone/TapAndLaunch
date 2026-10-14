import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/builder/FileUploadField";
import type { FilesBlockConfig } from "@/types/database";
import { linked } from "@/lib/builder/field-link";

type FileItem = NonNullable<FilesBlockConfig["items"]>[number];

const MAX_FILES = 20;

/** The editor for the Files block: a title, a line of context, and up to twenty files, each uploaded or pasted as a link. */
export function FilesBlockEditor({ config, organizationId, onChange }: { config: FilesBlockConfig; organizationId: string; onChange: (c: FilesBlockConfig) => void }) {
  const items = config.items ?? [];
  const setItem = (i: number, item: FileItem) => onChange({ ...config, items: items.map((x, j) => (j === i ? item : x)) });
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="files-title">Title</Label>
        <Input id="files-title" {...linked("title")} value={config.title ?? ""} maxLength={60} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="files-intro">A line under the title (optional)</Label>
        <Textarea id="files-intro" {...linked("intro")} rows={2} value={config.intro ?? ""} maxLength={200} onChange={(e) => onChange({ ...config, intro: e.target.value })} />
      </div>
      {items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <FileUploadField
                id={`file-${i}`}
                label={`File ${i + 1}`}
                organizationId={organizationId}
                value={item.url}
                onChange={(url, fileName) => setItem(i, { ...item, url, label: item.label || (fileName ? labelFromFileName(fileName) : "") })}
              />
            </div>
            <button
              type="button"
              aria-label="Remove this file"
              onClick={() => onChange({ ...config, items: items.filter((_, j) => j !== i) })}
              className="mt-6 grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <Input aria-label="Name shown for the file" placeholder="Name shown, like Week 1 handout" {...linked(["items", i, "label"])} value={item.label} maxLength={80} onChange={(e) => setItem(i, { ...item, label: e.target.value })} />
          <Input aria-label="A short note about the file" placeholder="A short note (optional)" {...linked(["items", i, "note"])} value={item.note ?? ""} maxLength={120} onChange={(e) => setItem(i, { ...item, note: e.target.value })} />
        </div>
      ))}
      {items.length < MAX_FILES && (
        <button
          type="button"
          onClick={() => onChange({ ...config, items: [...items, { label: "", url: "", note: "" }] })}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-neutral-100 transition hover:bg-white/15"
        >
          <Plus className="h-3.5 w-3.5" /> Add a file
        </button>
      )}
    </div>
  );
}

/** "02_Handout_First-Day-Writing-Exercise.docx" -> "Handout First Day Writing Exercise". */
export function labelFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^\d+[_\- ]+/, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
