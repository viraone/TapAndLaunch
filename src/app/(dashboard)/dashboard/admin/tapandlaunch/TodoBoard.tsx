"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

import type { TodoItem as Todo } from "@/lib/admin/todos";

export type { TodoItem as Todo } from "@/lib/admin/todos";

/**
 * The to-do list at the top of the daily board. Ticking saves at once; anything left unticked is simply still there
 * tomorrow. An item with steps shows them underneath, each with its own tick: the last step ticked finishes the item.
 * Items ticked today sit under "Done today" (untick to bring one back) and drop off after that.
 */
export function TodoBoard({ board, todos, sections, doneEarlier }: { board: "tapandlaunch" | "fitnessnav"; todos: Todo[]; sections: string[]; doneEarlier: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  // Steps start folded unless the item is part-way through, so a long list stays scannable.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (t: Todo) => open[t.id] ?? (t.steps.some((s) => s.done) && !t.steps.every((s) => s.done));

  async function call(body: Record<string, unknown>, onFail: string) {
    const res = await fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res?.ok) {
      toast.error(onFail);
      return false;
    }
    router.refresh();
    return true;
  }

  async function setDone(id: string, done: boolean, what: "item" | "step") {
    setBusy(id);
    const ok = await call({ action: "done", id, done }, "Couldn't save that tick. Try again.");
    setBusy(null);
    if (ok && done && what === "item") toast.success("Done. It'll drop off the list tomorrow.");
  }

  async function remove(t: Todo) {
    setBusy(t.id);
    await call({ action: "remove", id: t.id }, "Couldn't remove that. Try again.");
    setBusy(null);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    setBusy("add");
    const ok = await call({ action: "add", title: text, board }, "Couldn't add that. Try again.");
    setBusy(null);
    if (ok) setTitle("");
  }

  const openItems = todos.filter((t) => !t.done);
  const doneToday = todos.filter((t) => t.done);
  const order = [...sections, ...openItems.map((t) => t.section).filter((s) => !sections.includes(s))];
  const bySection = order.map((s) => ({ section: s, items: openItems.filter((t) => t.section === s) })).filter((g) => g.items.length);

  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">To do</h2>
        <p className="text-xs text-neutral-500">
          {openItems.length} open · {doneToday.length} done today{doneEarlier ? ` · ${doneEarlier} done before` : ""}
        </p>
      </div>

      {openItems.length === 0 && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">Nothing open. Add the next thing below.</p>}

      <div className="mt-4 space-y-5">
        {bySection.map((g) => (
          <div key={g.section}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{g.section}</h3>
            <ul className="mt-2 divide-y divide-neutral-100">
              {g.items.map((t) => {
                const doneSteps = t.steps.filter((s) => s.done).length;
                const showSteps = isOpen(t);
                return (
                  <li key={t.id} className="py-2.5">
                    <div className="flex items-start gap-3">
                      <input
                        id={`todo-${t.id}`}
                        type="checkbox"
                        checked={false}
                        disabled={busy === t.id}
                        onChange={() => void setDone(t.id, true, "item")}
                        className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-neutral-300 accent-emerald-600"
                      />
                      <label htmlFor={`todo-${t.id}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block font-medium">{t.title}</span>
                        {t.detail && <span className="mt-0.5 block text-sm text-neutral-500">{t.detail}</span>}
                      </label>
                      {t.steps.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpen({ ...open, [t.id]: !showSteps })}
                          aria-expanded={showSteps}
                          aria-controls={`steps-${t.id}`}
                          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition ${doneSteps ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-neutral-100 text-neutral-700 ring-neutral-200 hover:bg-neutral-200"}`}
                        >
                          {doneSteps} of {t.steps.length} {t.steps.length === 1 ? "step" : "steps"}
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSteps ? "rotate-180" : ""}`} aria-hidden />
                        </button>
                      )}
                      {!t.key && (
                        <button type="button" onClick={() => void remove(t)} disabled={busy === t.id} aria-label={`Remove ${t.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {t.steps.length > 0 && (
                      <ol id={`steps-${t.id}`} hidden={!showSteps} className="ml-8 mt-2 space-y-1 border-l-2 border-neutral-100 pl-4">
                        {t.steps.map((s, i) => (
                          <li key={s.id} className="flex items-start gap-3 py-1.5">
                            <input
                              id={`step-${s.id}`}
                              type="checkbox"
                              checked={s.done}
                              disabled={busy === s.id}
                              onChange={() => void setDone(s.id, !s.done, "step")}
                              className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-emerald-600"
                            />
                            <label htmlFor={`step-${s.id}`} className={`min-w-0 flex-1 cursor-pointer text-sm ${s.done ? "text-neutral-400 line-through" : ""}`}>
                              <span className="font-medium">
                                {i + 1}. {s.title}
                              </span>
                              {s.detail && !s.done && <span className="mt-0.5 block text-neutral-500">{s.detail}</span>}
                            </label>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="mt-5 flex gap-2">
        <label htmlFor="todo-new" className="sr-only">
          Add a to-do
        </label>
        <input
          id="todo-new"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Add something for today…"
          className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-4 text-sm outline-none transition focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5"
        />
        <button type="submit" disabled={busy === "add" || !title.trim()} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50">
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {doneToday.length > 0 && (
        <div className="mt-6 border-t border-neutral-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Done today</h3>
          <ul className="mt-2 divide-y divide-neutral-100">
            {doneToday.map((t) => (
              <li key={t.id} className="flex items-start gap-3 py-2">
                <input id={`todo-${t.id}`} type="checkbox" checked disabled={busy === t.id} onChange={() => void setDone(t.id, false, "item")} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-emerald-600" />
                <label htmlFor={`todo-${t.id}`} className="min-w-0 flex-1 cursor-pointer text-neutral-500 line-through">
                  {t.title}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">Untick to bring one back.</p>
        </div>
      )}
    </section>
  );
}
