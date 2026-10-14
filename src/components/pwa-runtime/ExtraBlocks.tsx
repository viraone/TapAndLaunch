"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Quote } from "lucide-react";
import { EditableText } from "@/components/pwa-runtime/Editable";
import type { ButtonBlockConfig, FaqBlockConfig, QuoteBlockConfig } from "@/types/database";

/** A button on its own: to one of the app's pages, or to a web address (tickets, a booking site, a video). */
export function ButtonBlockView({ config, live }: { config: ButtonBlockConfig; live: boolean }) {
  const label = config.label?.trim();
  if (!label && live) return null;
  const href = config.url?.trim() ? config.url.trim() : config.page ? `/${config.page}` : undefined;
  const external = !!config.url?.trim();
  const look =
    config.style === "outline"
      ? "bg-transparent text-foreground ring-2 ring-inset ring-primary"
      : config.style === "soft"
        ? "bg-primary/15 text-primary"
        : "bg-primary text-primary-foreground shadow-lg shadow-black/15";
  const align = config.align === "left" ? "justify-start" : config.align === "right" ? "justify-end" : "justify-center";
  const button = (
    <span className={`inline-flex min-h-12 items-center gap-2 rounded-[var(--button-radius,9999px)] px-6 text-[15px] font-bold ${look}`}>
      <EditableText path={["label"]} value={config.label} placeholder="Button text" />
      <ArrowRight className="h-4 w-4" />
    </span>
  );
  return (
    <div className={`flex px-4 py-4 ${align} @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-6`}>
      {live && href ? (
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
          {button}
        </a>
      ) : (
        button
      )}
    </div>
  );
}

/** One big quote: a review that deserves the whole width, a line from a press piece. */
export function QuoteBlockView({ config, live }: { config: QuoteBlockConfig; live: boolean }) {
  if (live && !config.quote?.trim()) return null;
  return (
    <section className="px-5 py-8 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-12">
      <figure className="text-center">
        <Quote className="mx-auto h-8 w-8 text-primary/60" aria-hidden="true" />
        <blockquote className="mt-3">
          <EditableText as="p" path={["quote"]} value={config.quote} placeholder="The quote" rich className="text-balance text-xl font-semibold leading-snug @lg:text-3xl" />
        </blockquote>
        <figcaption className="mt-4 text-sm font-medium text-muted-foreground">
          <EditableText path={["name"]} value={config.name} placeholder="Who said it" />
        </figcaption>
      </figure>
    </section>
  );
}

/** Questions that open to show their answers. */
export function FaqBlockView({ config, live }: { config: FaqBlockConfig; live: boolean }) {
  const items = (config.items ?? []).map((item, index) => ({ ...item, index })).filter((i) => !live || i.question?.trim());
  if (live && items.length === 0) return null;
  return (
    <section className="px-4 py-6 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-10">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Questions" className="text-2xl font-extrabold tracking-tight @lg:text-4xl" />
      <div className="mt-4 divide-y divide-border rounded-3xl bg-muted/60 ring-1 ring-border">
        {items.map((item) => (
          <FaqItem key={item.index} index={item.index} question={item.question} answer={item.answer} live={live} />
        ))}
        {items.length === 0 && <p className="p-5 text-sm text-muted-foreground">No questions yet. Add them on the right.</p>}
      </div>
    </section>
  );
}

function FaqItem({ index, question, answer, live }: { index: number; question?: string; answer?: string; live: boolean }) {
  // In the builder every answer is open so it can be edited; on the site they open on tap.
  const [open, setOpen] = useState(!live);
  return (
    <div className="px-5 py-4">
      <button type="button" onClick={() => live && setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 text-left">
        <EditableText as="span" path={["items", index, "question"]} value={question} placeholder="The question" className="text-[15px] font-semibold" />
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <EditableText as="div" path={["items", index, "answer"]} value={answer} placeholder="The answer" rich />
        </div>
      )}
    </div>
  );
}
