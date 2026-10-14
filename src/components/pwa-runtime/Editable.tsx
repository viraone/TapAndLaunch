"use client";

import { createContext, createElement, useContext } from "react";
import { cn } from "@/lib/utils";

/**
 * In-place editing of a block's words, Squarespace-style: in the builder, the text of a section is the thing you
 * click and type in. The builder provides this context around each section; on the published site there is none,
 * and `EditableText` is plain text.
 */
export interface BlockEditing {
  /** Replaces one field of the block's config, by path: `["headline"]`, `["items", 2, "label"]`. */
  set: (path: Array<string | number>, value: string) => void;
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

  if (!editing) {
    if (!text) return fallback ? createElement(as, { className }, fallback) : null;
    return createElement(as, { className: cn(className, multiline && "whitespace-pre-wrap") }, text);
  }

  return createElement(
    as,
    {
      contentEditable: true,
      suppressContentEditableWarning: true,
      role: "textbox",
      "aria-label": placeholder ?? "Text",
      "aria-multiline": multiline,
      "data-placeholder": placeholder ?? fallback ?? "",
      spellCheck: true,
      className: cn(
        className,
        "pointer-events-auto cursor-text rounded-sm outline-none ring-offset-1 transition hover:ring-1 hover:ring-indigo-400/70 focus:ring-2 focus:ring-indigo-500",
        "empty:before:pointer-events-none empty:before:opacity-50 empty:before:content-[attr(data-placeholder)]",
        "whitespace-pre-wrap"
      ),
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
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
      },
      // A click starts editing and must not count as "select the section" for the wrapper around it.
      onMouseDown: (e: React.MouseEvent<HTMLElement>) => e.stopPropagation(),
      // Pasted text comes in plain, never as formatting from another site.
      onPaste: (e: React.ClipboardEvent<HTMLElement>) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const next = (multiline ? el.innerText : el.textContent ?? "").replace(/\n+$/, "");
        if (next !== text) editing.set(path, next);
      },
    },
    text
  );
}
