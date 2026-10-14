"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Globe, Loader2, Sparkles, X } from "lucide-react";

export type AskScope = "section" | "site";

const EXAMPLES: Record<AskScope, string[]> = {
  section: ["Make this friendlier", "Mention my Friday show", "Shorter, and no exclamation marks", "Say it in Spanish"],
  site: ["Add a Private events page and link it from the banner button", "Make everything sound less formal", "Add a reviews section under the banner", "Change my name to Dave's Garage everywhere"],
};

/**
 * Cmd+K. One bar for both kinds of request: "This section" rewrites the words of the section that is selected,
 * "Whole site" hands the request to the agent. Either way the answer lands on the page as changes with Keep / Undo,
 * never in a transcript. Enter runs it, Escape closes it.
 */
export function AskAiBar({
  open,
  scope,
  sectionLabel,
  busy,
  onScope,
  onClose,
  onSubmit,
}: {
  open: boolean;
  scope: AskScope;
  /** "Banner", "Reviews": the selected section's name, when there is one. */
  sectionLabel: string | null;
  /** What the AI is doing right now, or null. */
  busy: string | null;
  onScope: (scope: AskScope) => void;
  onClose: () => void;
  /** Resolves true when the change landed (the bar then closes). */
  onSubmit: (instruction: string, scope: AskScope) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  // A different example each time a request runs, so the owner sees the range of what it can do.
  const [example, setExample] = useState(() => Math.floor(Math.random() * 8));
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 30);
  }, [open]);

  if (!open) return null;
  const canSection = !!sectionLabel;
  const effective: AskScope = scope === "section" && canSection ? "section" : "site";
  const placeholder = EXAMPLES[effective][example % EXAMPLES[effective].length];

  async function submit() {
    const instruction = text.trim();
    if (!instruction || busy) return;
    const ok = await onSubmit(instruction, effective);
    setExample((n) => n + 1);
    if (ok) {
      setText("");
      onClose();
    }
  }

  return (
    <div role="dialog" aria-label="Ask AI" className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-neutral-950/95 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_24px_60px_-20px_rgba(129,140,248,0.7)] backdrop-blur">
        <div className="flex items-center gap-2">
          {/* What the request is about. The chip switches between the selected section and the whole site. */}
          <button
            type="button"
            onClick={() => {
              onScope(effective === "section" ? "site" : "section");
              input.current?.focus();
            }}
            disabled={!canSection}
            title={canSection ? "Switch between this section and the whole site" : "Select a section on the page to ask about just that section"}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-medium text-neutral-100 transition hover:bg-white/15 disabled:cursor-default disabled:hover:bg-white/10"
          >
            {effective === "section" ? <Sparkles className="h-4 w-4 text-fuchsia-300" /> : <Globe className="h-4 w-4 text-indigo-300" />}
            {effective === "section" ? `${sectionLabel} section` : "Whole site"}
          </button>
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            disabled={!!busy}
            placeholder={busy ?? placeholder}
            aria-label={effective === "section" ? "What should change in this section?" : "What should change on the site?"}
            className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-white placeholder:text-neutral-500 focus:outline-none disabled:opacity-70"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || !!busy}
            aria-label="Run"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-neutral-950 transition hover:bg-indigo-50 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-300 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-3 pb-1 pt-1.5 text-xs text-neutral-400">
          {effective === "section" ? "Only this section's words change." : "Pages, sections and words across the site can change."} Each change comes with Keep and Undo. <kbd className="rounded bg-white/10 px-1">⌘K</kbd> opens this any time.
        </p>
      </div>
    </div>
  );
}
