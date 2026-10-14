import { ArrowUpRight } from "lucide-react";
import type { FilesBlockConfig } from "@/types/database";
import { EditableText } from "@/components/pwa-runtime/Editable";

/**
 * Files visitors can open or download: a class's handouts, a menu as a PDF, a registration form, slides. Each file is
 * one tappable row that opens in a new tab (a phone shows a PDF in place and downloads anything else). Uses the app's
 * theme tokens so it looks right in light and dark apps; `live` is false in the builder's preview, where rows don't
 * navigate and an empty block shows a hint instead of nothing.
 */
export function FilesBlockView({ config, live }: { config: FilesBlockConfig; live: boolean }) {
  const items = (config.items ?? []).filter((i) => i.url?.trim());
  if (items.length === 0) {
    if (live) return null;
    return <div className="mx-4 my-3 flex h-24 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">No files yet</div>;
  }
  return (
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-10">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Files" className="px-1 text-2xl font-extrabold tracking-tight @lg:text-4xl" />
      <EditableText as="p" path={["intro"]} value={config.intro} placeholder="A line under the title" className="mt-1 px-1 text-sm text-muted-foreground" />
      <ul className={`space-y-2 ${config.title || config.intro ? "mt-4" : ""}`}>
        {items.map((item, i) => {
          const kind = fileKind(item.url);
          return (
            <li key={i}>
              <a
                href={live ? item.url : undefined}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-16 items-center gap-3 rounded-2xl bg-muted/60 p-3 ring-1 ring-border transition [&:hover]:bg-muted"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-[11px] font-extrabold uppercase tracking-wide text-primary">
                  {kind}
                </span>
                <span className="min-w-0 flex-1">
                  <EditableText as="span" path={["items", i, "label"]} value={item.label} fallback={fileName(item.url)} placeholder={fileName(item.url)} className="block truncate text-[15px] font-semibold" />
                  <EditableText as="span" path={["items", i, "note"]} value={item.note} placeholder="A short note" className="mt-0.5 block text-sm leading-snug text-muted-foreground" />
                </span>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A short badge for the file's kind, from its extension: "PDF", "Doc", "Slides"... "File" when unknown. */
export function fileKind(url: string): string {
  const ext = extensionOf(url);
  if (ext === "pdf") return "PDF";
  if (["doc", "docx", "pages", "odt", "rtf"].includes(ext)) return "Doc";
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return "Slides";
  if (["xls", "xlsx", "numbers", "csv", "ods"].includes(ext)) return "Sheet";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"].includes(ext)) return "Photo";
  if (["mp3", "m4a", "wav", "aac"].includes(ext)) return "Audio";
  if (["mp4", "mov", "m4v", "webm"].includes(ext)) return "Video";
  if (["txt", "md"].includes(ext)) return "Text";
  if (ext === "zip") return "Zip";
  return "File";
}

function extensionOf(url: string): string {
  const path = url.split(/[?#]/)[0] ?? "";
  const last = path.split("/").pop() ?? "";
  return last.includes(".") ? last.split(".").pop()!.toLowerCase() : "";
}

/** The last part of the address, for a file whose label was left empty. */
function fileName(url: string): string {
  const path = url.split(/[?#]/)[0] ?? "";
  try {
    return decodeURIComponent(path.split("/").pop() || url);
  } catch {
    return path.split("/").pop() || url;
  }
}
