"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, KeyRound, Loader2, X } from "lucide-react";

type Provider = "anthropic" | "openai";
export interface SavedKey {
  provider: Provider;
  hint: string;
  model: string;
}
interface Message {
  role: "user" | "assistant";
  content: string;
  note?: string;
  error?: boolean;
}

const PROVIDERS: Record<Provider, { label: string; where: string; url: string }> = {
  anthropic: { label: "Anthropic (Claude)", where: "console.anthropic.com → API Keys → Create key", url: "https://console.anthropic.com/settings/keys" },
  openai: { label: "OpenAI (ChatGPT)", where: "platform.openai.com → API keys → Create new secret key", url: "https://platform.openai.com/api-keys" },
};

const EXAMPLES = ["Add a menu page with my 5 most popular dishes", "Make the colors dark green", "Add a photo banner with a Book now button", "Add reviews from happy customers"];

/**
 * "BYOB: Bring your own bot". A chat panel in the builder: the owner pastes their own AI key once, then describes changes
 * and the app updates. It sits outside the builder itself so the conversation survives the builder reloading the app.
 */
export function AiChatPanel({ appId, appName, initiallyOpen = false }: { appId: string; appName: string; initiallyOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [key, setKey] = useState<SavedKey | null | undefined>(undefined);
  const [canManage, setCanManage] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || key !== undefined) return;
    void fetch("/api/organizations/ai-key")
      .then((r) => r.json())
      .then((body: { key: SavedKey | null; canManage: boolean }) => {
        setKey(body.key);
        setCanManage(body.canManage);
      })
      .catch(() => setKey(null));
  }, [open, key]);

  useEffect(() => {
    const onDirty = (e: Event) => setDirty(Boolean((e as CustomEvent<{ dirty: boolean }>).detail?.dirty));
    window.addEventListener("builder-dirty", onDirty);
    return () => window.removeEventListener("builder-dirty", onDirty);
  }, []);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => !m.error).slice(-10).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`/api/apps/${appId}/ai-chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history }) });
      const body = (await res.json()) as { reply?: string; applied?: number; skipped?: string[]; error?: string; needsKey?: boolean };
      if (!res.ok) {
        if (body.needsKey) setKey(null);
        setMessages((m) => [...m, { role: "assistant", content: body.error ?? "Something went wrong. Try again.", error: true }]);
        return;
      }
      const note = body.applied ? `${body.applied} change${body.applied === 1 ? "" : "s"} made${body.skipped?.length ? `, ${body.skipped.length} skipped` : ""}` : undefined;
      setMessages((m) => [...m, { role: "assistant", content: body.reply ?? "Done.", note }]);
      if (body.applied) router.refresh();
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the server. Check your connection and try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 px-5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/30 transition hover:brightness-110"
      >
        <Bot className="h-5 w-5" /> Build with AI
      </button>
    );
  }

  return (
    <aside
      aria-label="Build with AI"
      className="dark fixed inset-x-3 bottom-3 z-50 flex max-h-[80dvh] flex-col overflow-hidden rounded-3xl bg-neutral-950 text-neutral-100 shadow-2xl ring-1 ring-white/10 sm:inset-x-auto sm:right-5 sm:w-[400px]"
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Build with AI</p>
          <p className="truncate text-xs text-neutral-400">{key ? `${PROVIDERS[key.provider].label} · key ${key.hint}` : "Bring your own bot"}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </header>

      {key === undefined ? (
        <div className="grid flex-1 place-items-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
        </div>
      ) : key === null ? (
        <KeyForm canManage={canManage} onSaved={setKey} />
      ) : (
        <>
          <div className="min-h-48 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-300">
                  Tell me what to change in <span className="font-semibold text-white">{appName}</span>. I&apos;ll add pages, menus, bookings, photos and colors.
                </p>
                <div className="flex flex-col gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} type="button" disabled={busy || dirty} onClick={() => void send(ex)} className="min-h-11 rounded-2xl bg-white/[0.06] px-3 text-left text-sm text-neutral-200 transition hover:bg-white/10 disabled:opacity-50">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-indigo-500 text-white" : m.error ? "bg-red-500/15 text-red-200" : "bg-white/[0.07] text-neutral-100"}`}>
                  {m.content}
                  {m.note && <p className="mt-1 text-xs text-emerald-300">{m.note}</p>}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Working on it…
              </div>
            )}
            <div ref={listEnd} />
          </div>
          {dirty && <p className="border-t border-white/10 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">You have unsaved changes. Click Save draft first, so the AI works on your latest version.</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 border-t border-white/10 p-3"
          >
            <label htmlFor="ai-message" className="sr-only">
              Message
            </label>
            <textarea
              id="ai-message"
              rows={1}
              maxLength={1000}
              value={input}
              disabled={busy || dirty}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Add a menu page…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-sm outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-indigo-400/50 disabled:opacity-50"
            />
            <button type="submit" disabled={busy || dirty || !input.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-neutral-950 disabled:opacity-40">
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
        </>
      )}
    </aside>
  );
}

export function KeyForm({ canManage, onSaved }: { canManage: boolean; onSaved: (key: SavedKey) => void }) {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return <p className="p-5 text-sm text-neutral-300">Ask an admin of your organization to add an AI key in Settings. Then you can build by chatting here.</p>;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations/ai-key", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, key: value }) });
      const body = (await res.json()) as { key?: SavedKey; error?: string };
      if (!res.ok || !body.key) {
        setError(body.error ?? "Couldn't save the key.");
        return;
      }
      setValue("");
      onSaved(body.key);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 overflow-y-auto p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
        <p className="text-sm text-neutral-300">
          <span className="font-semibold text-white">Bring your own bot.</span> Paste your own AI key and build your app by chatting. The AI usage is billed to your own AI account, usually a few cents per change.
        </p>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Your AI provider</legend>
        {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
          <label key={p} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 ring-1 ${provider === p ? "bg-white/10 ring-indigo-400" : "ring-white/10"}`}>
            <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="accent-indigo-400" />
            <span className="text-sm">{PROVIDERS[p].label}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="ai-key" className="mb-1.5 block text-sm font-medium">
          API key
        </label>
        <input
          id="ai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
          className="h-11 w-full rounded-xl bg-white/[0.06] px-3.5 text-sm outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-indigo-400/60"
        />
        <p className="mt-1.5 text-xs text-neutral-400">
          Get one at{" "}
          <a href={PROVIDERS[provider].url} target="_blank" rel="noreferrer" className="underline">
            {PROVIDERS[provider].where}
          </a>
          . We check it works, store it encrypted, and only ever show its last 4 characters.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      <button type="submit" disabled={saving || value.trim().length < 20} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-neutral-950 disabled:opacity-50">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} {saving ? "Checking your key…" : "Save key and start building"}
      </button>
    </form>
  );
}
