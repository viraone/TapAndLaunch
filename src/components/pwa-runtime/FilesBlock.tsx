"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown, Folder, FolderOpen, Lock } from "lucide-react";
import type { FilesBlockConfig } from "@/types/database";
import { EditableText } from "@/components/pwa-runtime/Editable";

/**
 * Files visitors can open or download: a class's handouts, a menu as a PDF, a registration form, slides. Each file is
 * one tappable row that opens in a new tab (a phone shows a PDF in place and downloads anything else). With
 * `collapsed` the block is one card: the title, the intro and a file count, and the rows appear when the card is
 * tapped. Uses the app's theme tokens so it looks right in light and dark apps; `live` is false in the builder's
 * preview, where rows don't navigate, a folded card starts open so its rows can be edited, and an empty block shows a
 * hint instead of nothing.
 */
export function FilesBlockView({ config, live }: { config: FilesBlockConfig; live: boolean }) {
  const items = (config.items ?? []).filter((i) => i.url?.trim());
  const folded = !!config.collapsed;
  const locked = !!config.disabled;
  // The builder always starts open so the rows can be edited; on the site a folded card starts closed.
  const [open, setOpen] = useState(!live || !folded);
  if (items.length === 0) {
    if (live) return null;
    return <div className="mx-4 my-3 flex h-24 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">No files yet</div>;
  }
  const list = (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const kind = fileKind(item.url);
        return (
          <li key={i}>
            {locked ? (
              <div aria-disabled="true" className="flex min-h-16 cursor-not-allowed select-none items-center gap-3 rounded-2xl bg-muted/40 p-3 opacity-50 ring-1 ring-border grayscale">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  {kind}
                </span>
                <span className="min-w-0 flex-1">
                  <EditableText as="span" path={["items", i, "label"]} value={item.label} fallback={fileName(item.url)} placeholder={fileName(item.url)} className="line-clamp-2 block text-[15px] font-semibold leading-snug" />
                  <EditableText as="span" path={["items", i, "note"]} value={item.note} placeholder="A short note" className="mt-0.5 block text-sm leading-snug text-muted-foreground" />
                </span>
                <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
            ) : (
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
                  <EditableText as="span" path={["items", i, "label"]} value={item.label} fallback={fileName(item.url)} placeholder={fileName(item.url)} className="line-clamp-2 block text-[15px] font-semibold leading-snug" />
                  <EditableText as="span" path={["items", i, "note"]} value={item.note} placeholder="A short note" className="mt-0.5 block text-sm leading-snug text-muted-foreground" />
                </span>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (folded) {
    const count = items.length === 1 ? "1 file" : `${items.length} files`;
    return (
      <section className="px-4 py-3 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-6">
        <div className="rounded-3xl bg-muted/60 ring-1 ring-border">
          <button
            type="button"
            onClick={() => live && setOpen((o) => !o)}
            aria-expanded={open}
            className="flex min-h-16 w-full items-center gap-3 px-5 py-4 text-left"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary" aria-hidden="true">
              {open ? <FolderOpen className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <EditableText as="span" path={["title"]} value={config.title} placeholder="Files" className="block text-lg font-extrabold tracking-tight @lg:text-2xl" />
              <EditableText as="span" path={["intro"]} value={config.intro} placeholder="A line under the title" className="mt-0.5 block text-sm text-muted-foreground" />
            </span>
            <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">{count}</span>
            <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open && <div className="px-3 pb-3">{list}</div>}
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-10">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Files" className="px-1 text-2xl font-extrabold tracking-tight @lg:text-4xl" />
      <EditableText as="p" path={["intro"]} value={config.intro} placeholder="A line under the title" className="mt-1 px-1 text-sm text-muted-foreground" />
      <div className={config.title || config.intro ? "mt-4" : ""}>{list}</div>
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
