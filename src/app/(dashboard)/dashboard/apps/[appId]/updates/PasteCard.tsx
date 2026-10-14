"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Sparkles, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { uploadAppAsset } from "@/lib/storage/upload";
import { formatDayTimeRange } from "@/lib/format-date";
import type { ThemeConfig } from "@/types/database";

interface Outcome {
  summary: string;
  events: Array<{ id: string; title: string; starts_at: string; location: string | null }>;
  announcement: { before: ThemeConfig["announcement"] | null; after: string } | null;
  sections: Array<{ page: string; index: number }>;
  questions: string[];
  undo: { eventIds: string[]; theme: ThemeConfig | null; pages: Array<{ pageId: string; blocks: Array<{ type: string; config: unknown; min_tier: string | null }> }> };
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Paste anything. A flyer (picture), an Instagram caption, a text from the venue, an email: the site works out what
 * it means (a show, a notice, a changed detail) and does it, then says what landed, with one Undo. Built so a client
 * who never opens the builder still keeps the site current, from the one thing they already have in their hand.
 */
export function PasteCard({ appId, organizationId }: { appId: string; organizationId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [undone, setUndone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That isn't a picture.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That picture is over 10 MB. Try a screenshot of it.");
      return;
    }
    if (image) URL.revokeObjectURL(image.url);
    setImage({ file, url: URL.createObjectURL(file) });
  }

  // A picture pasted from the clipboard (a screenshot, a flyer copied from a chat) lands like a chosen file.
  function onPaste(e: React.ClipboardEvent) {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      pickImage(file);
    }
  }

  async function run() {
    if (!text.trim() && !image) return;
    setBusy(image ? "Reading the picture…" : "Reading…");
    setOutcome(null);
    setUndone(false);
    try {
      let image_url: string | undefined;
      if (image) image_url = await uploadAppAsset(createClient(), organizationId, image.file);
      const res = await fetch(`/api/apps/${appId}/ai/inbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() || undefined, image_url, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const body = (await res.json()) as Outcome & { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't read that");
        return;
      }
      setOutcome(body);
      setText("");
      if (image) URL.revokeObjectURL(image.url);
      setImage(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    if (!outcome) return;
    setBusy("Undoing…");
    try {
      for (const id of outcome.undo.eventIds) await fetch(`/api/apps/${appId}/events/${id}`, { method: "DELETE" });
      if (outcome.undo.theme) await fetch(`/api/apps/${appId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: outcome.undo.theme }) });
      for (const page of outcome.undo.pages) {
        await fetch(`/api/apps/${appId}/pages/${page.pageId}/blocks`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: page.blocks.map((b, position) => ({ type: b.type, position, config: b.config, min_tier: b.min_tier })) }),
        });
      }
      setUndone(true);
      router.refresh();
      toast.success("Put back the way it was");
    } finally {
      setBusy(null);
    }
  }

  const landed = outcome ? outcome.events.length + (outcome.announcement ? 1 : 0) + outcome.sections.length : 0;

  return (
    <section className="rounded-3xl bg-neutral-950 p-5 text-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.4)] ring-1 ring-black/5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-neutral-950">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Paste anything</h2>
          <p className="text-sm text-neutral-400">A flyer, an Instagram post, a text from the venue, an email. The site works out what changed and does it.</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          rows={4}
          maxLength={6000}
          disabled={!!busy}
          placeholder={"Paste here. For example:\nHALLOWEEN LAUGHS · Fri Oct 31 · 8pm · The Rickshaw · tickets at ..."}
          className="border-white/10 bg-white/5 text-white placeholder:text-neutral-500"
        />
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
        <div className="flex flex-wrap items-center gap-2">
          {image ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file */}
              <img src={image.url} alt="" className="h-7 w-7 rounded-full object-cover" />
              {image.file.name.length > 24 ? `${image.file.name.slice(0, 21)}…` : image.file.name}
              <button type="button" onClick={() => { URL.revokeObjectURL(image.url); setImage(null); }} aria-label="Remove the picture" className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => fileInput.current?.click()} className="h-11 rounded-full border-white/15 bg-transparent px-4 text-white hover:bg-white/10 hover:text-white">
              <ImagePlus className="h-4 w-4" /> Add a flyer or screenshot
            </Button>
          )}
          <Button type="button" disabled={!!busy || (!text.trim() && !image)} onClick={() => void run()} className="h-11 rounded-full bg-white px-5 text-neutral-950 hover:bg-indigo-50">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {busy}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Update the site
              </>
            )}
          </Button>
        </div>
      </div>

      {outcome && (
        <div className={`mt-5 rounded-2xl p-4 ring-1 ${undone ? "bg-white/5 ring-white/10" : "bg-emerald-400/10 ring-emerald-400/30"}`}>
          <p className="text-sm font-medium">{undone ? "Undone. Nothing from that paste is on the site." : outcome.summary}</p>
          {!undone && landed > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-neutral-200">
              {outcome.events.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>
                    On the calendar: <strong>{e.title}</strong>, {formatDayTimeRange(new Date(e.starts_at), null)}
                    {e.location ? `, ${e.location}` : ""}
                  </span>
                </li>
              ))}
              {outcome.announcement && (
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>
                    Across the top of every page: <strong>{outcome.announcement.after}</strong>
                  </span>
                </li>
              )}
              {outcome.sections.map((s) => (
                <li key={`${s.page}-${s.index}`} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>Changed a section on the {s.page} page</span>
                </li>
              ))}
            </ul>
          )}
          {!undone && outcome.questions.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-amber-200">
              {outcome.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          )}
          {!undone && landed > 0 && (
            <button type="button" disabled={!!busy} onClick={() => void undo()} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-medium transition hover:bg-white/15 disabled:opacity-50">
              <Undo2 className="h-4 w-4" /> Undo all of this
            </button>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-neutral-500">Shows go on the calendar. A notice goes across the top of every page. A new detail (hours, a price) changes the section it lives in. Nothing else is touched, and every paste can be undone.</p>
    </section>
  );
}
