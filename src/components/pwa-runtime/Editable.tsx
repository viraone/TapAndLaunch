"use client";

import { createContext, createElement, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { announceField, fieldKey, FIELD_FOCUS_EVENT, FIELD_HOT_ATTR, FIELD_HOT_MS, type FieldFocusDetail } from "@/lib/builder/field-link";

/**
 * In-place editing of a block's words, Squarespace-style: in the builder, the text of a section is the thing you
 * click and type in. The builder provides this context around each section; on the published site there is none,
 * and `EditableText` is plain text.
 */
export interface BlockEditing {
  /** Replaces one field of the block's config, by path: `["headline"]`, `["items", 2, "label"]`. */
  set: (path: Array<string | number>, value: string) => void;
  /** Uploads a picture the owner chose and returns its address; the builder provides it. */
  upload?: (file: File) => Promise<string>;
}

export const BlockEditContext = createContext<BlockEditing | null>(null);

export function EditableText({
  as = "span",
  path,
  value,
  className,
  placeholder,
  multiline = false,
  fallback,
}: {
  /** The HTML tag to render: "h2", "p", "span", "dd"... */
  as?: string;
  /** Where the text lives in the block's config. */
  path: Array<string | number>;
  value: string | null | undefined;
  className?: string;
  /** Shown faintly in the builder while the field is empty. */
  placeholder?: string;
  /** Enter adds a line (otherwise Enter finishes editing). */
  multiline?: boolean;
  /** What the published site shows when the field is empty (nothing, by default). */
  fallback?: string;
}) {
  const editing = useContext(BlockEditContext);
  const text = value ?? "";
  const key = fieldKey(path);
  const el = useRef<HTMLElement>(null);

  // Lights up when its box in the inspector is focused.
  useEffect(() => {
    if (!editing) return;
    const onFocus = (e: Event) => {
      const { key: k, source } = (e as CustomEvent<FieldFocusDetail>).detail;
      if (source !== "inspector" || k !== key || !el.current) return;
      el.current.setAttribute(FIELD_HOT_ATTR, "true");
      el.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      window.setTimeout(() => el.current?.removeAttribute(FIELD_HOT_ATTR), FIELD_HOT_MS);
    };
    window.addEventListener(FIELD_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(FIELD_FOCUS_EVENT, onFocus);
  }, [editing, key]);

  if (!editing) {
    if (!text) return fallback ? createElement(as, { className }, fallback) : null;
    return createElement(as, { className: cn(className, multiline && "whitespace-pre-wrap") }, text);
  }

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={el}
      data-field={key}
      onFocus={() => announceField(key, "page")}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder ?? "Text"}
      aria-multiline={multiline}
      data-placeholder={placeholder ?? fallback ?? ""}
      spellCheck
      className={cn(
        className,
        "pointer-events-auto cursor-text rounded-sm outline-none ring-offset-1 transition hover:ring-1 hover:ring-indigo-400/70 focus:ring-2 focus:ring-indigo-500",
        "empty:before:pointer-events-none empty:before:opacity-50 empty:before:content-[attr(data-placeholder)]",
        "whitespace-pre-wrap"
      )}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape" || (e.key === "Enter" && !multiline)) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        // Select all selects this field's words, not the whole builder page.
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(e.currentTarget);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }}
      // A click starts editing and must not count as "select the section" for the wrapper around it.
      onMouseDown={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
      // Pasted text comes in plain, never as formatting from another site.
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const target = e.currentTarget;
        const next = (multiline ? target.innerText : (target.textContent ?? "")).replace(/\n+$/, "");
        if (next !== text) editing.set(path, next);
      }}
    >
      {text}
    </Tag>
  );
}

/**
 * A picture that can be replaced by clicking it, in the builder: the click opens the file picker, the chosen file is
 * uploaded and its address written to `path`. On the published site it is a plain <img>. `children` lets a caller
 * wrap the picture (the banner draws its photo behind a gradient and text).
 */
export function EditableImage({
  path,
  src,
  alt = "",
  className,
  imgClassName,
  label = "Replace this photo",
}: {
  path: Array<string | number>;
  src: string;
  alt?: string;
  /** Classes for the wrapper in the builder (the <img> itself on the published site). */
  className?: string;
  /** Classes for the <img> inside the builder's wrapper; defaults to filling it. */
  imgClassName?: string;
  label?: string;
}) {
  const editing = useContext(BlockEditContext);
  if (!editing?.upload) {
    // eslint-disable-next-line @next/next/no-img-element -- tenant uploads and template photos, any host
    return <img src={src} alt={alt} className={className} loading="lazy" />;
  }
  const upload = editing.upload;
  return (
    <ReplaceablePicture className={className} label={label} onFile={async (file) => editing.set(path, await upload(file))}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tenant uploads and template photos, any host */}
      <img src={src} alt={alt} className={imgClassName ?? "h-full w-full object-cover"} />
    </ReplaceablePicture>
  );
}

function ReplaceablePicture({ className, label, onFile, children, pill = false }: { className?: string; label: string; onFile: (file: File) => Promise<void>; children: React.ReactNode; /** The children are the button itself, not a picture to cover with an overlay. */ pill?: boolean }) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      title="Click to replace"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) input.current?.click();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          input.current?.click();
        }
      }}
      className={cn("group/pic pointer-events-auto relative block cursor-pointer overflow-hidden", className)}
    >
      {pill && busy ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950/80 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20">Uploading…</span>
      ) : (
        children
      )}
      {!pill && (
        <span className={cn("absolute inset-0 grid place-items-center bg-black/45 text-xs font-semibold text-white transition", busy ? "opacity-100" : "opacity-0 group-hover/pic:opacity-100")}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950/80 px-3 py-1.5 ring-1 ring-white/20">
            <ImageUp className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Replace photo"}
          </span>
        </span>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await onFile(file);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </span>
  );
}

/**
 * A small "Replace photo" button for a picture that sits behind other things (the banner's background, under its
 * gradient and words), where clicking the picture itself can't work. Renders nothing on the published site.
 */
export function ReplacePhotoButton({ path, label = "Replace the background photo", className }: { path: Array<string | number>; label?: string; className?: string }) {
  const editing = useContext(BlockEditContext);
  if (!editing?.upload) return null;
  const upload = editing.upload;
  return (
    <ReplaceablePicture className={cn("pointer-events-auto", className)} label={label} onFile={async (file) => editing.set(path, await upload(file))} pill>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950/80 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur">
        <ImageUp className="h-3.5 w-3.5" /> Replace photo
      </span>
    </ReplaceablePicture>
  );
}
