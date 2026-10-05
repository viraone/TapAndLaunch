"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowUp, ArrowUpRight, Database, FileCode2, History, Loader2, Monitor, RotateCcw, Rocket, Smartphone, Sparkles, Wrench } from "lucide-react";
import { buildCodeDocument } from "@/lib/code/document";
import { applyChanges, applyEdits, parseReply } from "@/lib/code/files";
import { demux, splitStream } from "@/lib/code/protocol";
import { CODE_EXAMPLES } from "@/lib/code/prompt";
import { isFreshApp, SHARED_PATH } from "@/lib/code/first-build";
import { runnablePartial } from "@/lib/code/partial";
import { createClient } from "@/lib/supabase/client";
import { KeyForm, type SavedKey } from "@/components/builder/AiChatPanel";
import { DictationButton } from "@/components/builder/DictationButton";
import { DatabasePanel, type DbState } from "@/components/builder/DatabasePanel";

interface Message {
  role: "user" | "assistant";
  content: string;
  note?: string;
  error?: boolean;
}
interface VersionInfo {
  version: number;
  summary: string | null;
  created_at: string;
}

const MAX_AUTO_FIXES = 2;

/** What a file still being written says so far, without the opening tag the AI started it with. */
function streamedBody(text: string): string | null {
  const m = /<file\s+path="[^"]*"\s*>\n?/.exec(text);
  return m ? text.slice(m.index + m[0].length) : null;
}

/**
 * Before a new app's App.jsx is written, its sections are already being written. Until App.jsx arrives, the preview
 * stacks them in the order they were planned, so they can be seen from the first moment.
 */
function stackedApp(paths: string[]): string {
  const parts = paths.filter((p) => /^src\/components\/[A-Z][A-Za-z0-9]*\.jsx$/.test(p)).map((p) => ({ name: `Tl${(p.split("/").pop() as string).replace(".jsx", "")}`, spec: `@/${p.slice(4, -4)}` }));
  // Before any section is planned: one placeholder, so the old page goes away the moment the owner hits send.
  const body = parts.length ? parts.map((p) => `<${p.name} />`).join("") : `<div className="tl-stub"><span>Planning your app\u2026</span></div>`;
  return `${parts.map((p) => `import ${p.name} from '${p.spec}';`).join("\n")}
export default function App() {
  return <div className="min-h-screen bg-white font-sans text-slate-900">${body}</div>;
}`;
}

/** A cheap way to tell whether a draft changed since the last one was shown. */
const shape = (files: Record<string, string>) => Object.keys(files).sort().map((p) => `${p}:${(files[p] as string).length}`).join("|");

/**
 * "BYOB" code mode: the owner chats, their own AI writes a React app, and it runs live next to the chat in a sandboxed
 * frame (no access to TapAndLaunch's cookies or storage). Versions are kept so any change can be undone. Errors the app
 * hits are sent back to the AI to fix, up to twice, like a developer reading the console.
 */
export function CodeBuilder({
  appId,
  appName,
  accent,
  slug,
  rootDomain,
  initialFiles,
  initialVersion,
  initialVersions,
  initialStatus,
  initialPublished,
  takenDown = null,
}: {
  appId: string;
  appName: string;
  accent?: string;
  slug: string;
  rootDomain: string;
  initialFiles: Record<string, string>;
  initialVersion: number;
  initialVersions: VersionInfo[];
  initialStatus: "draft" | "published";
  initialPublished: number | null;
  /** Set when TapAndLaunch took the app down: the reason (possibly empty). */
  takenDown?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [files, setFiles] = useState(initialFiles);
  const [version, setVersion] = useState(initialVersion);
  const [versions, setVersions] = useState(initialVersions);
  const [status, setStatus] = useState(initialStatus);
  const [published, setPublished] = useState(initialPublished);
  const [viewing, setViewing] = useState<{ version: number; files: Record<string, string> } | null>(null);
  const [device, setDevice] = useState<"phone" | "desktop">("desktop");
  const [tab, setTab] = useState<"chat" | "preview">("chat");
  const [key, setKey] = useState<SavedKey | null | undefined>(undefined);
  const [canManage, setCanManage] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ reply: string; written: string[]; writing: string[] } | null>(null);
  // The app as far as it has been written, shown in the preview while the AI is still working.
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  // The app's own database (see DatabasePanel): its status and the setup files the owner still has to run.
  const [db, setDb] = useState<DbState | null>(null);
  const [dbOpen, setDbOpen] = useState(false);
  const loadDb = useCallback(async () => {
    const res = await fetch(`/api/apps/${appId}/backend`).catch(() => null);
    if (!res?.ok) return null;
    const next = (await res.json()) as DbState;
    setDb(next);
    return next;
  }, [appId]);
  useEffect(() => {
    void fetch(`/api/apps/${appId}/backend`)
      .then((r) => (r.ok ? (r.json() as Promise<DbState>) : null))
      .then((next) => next && setDb(next))
      .catch(() => {});
  }, [appId]);
  // Sign-ins inside the preview (apps with a database): kept here, in memory, while the builder is open.
  const previewStorage = useRef(new Map<string, string>());
  const [elapsed, setElapsed] = useState(0);
  const listEnd = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const autoFixes = useRef(0);
  const builtThisSession = useRef(false);
  const lastFixedError = useRef<string | null>(null);

  const shown = viewing?.files ?? draft ?? files;
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // The preview page is loaded once. Every later version (each moment of a build, the saved result, an old version) is
  // sent into it, so it changes in place instead of reloading. Each one gets a number; the page sends that number back
  // with its news, so news about a version that has since been replaced is ignored.
  const [srcDoc] = useState(() => buildCodeDocument(initialFiles, { title: appName, accent }));
  const onScreen = useRef<{ rev: number; files: Record<string, string>; stubs: boolean }>({ rev: 0, files: initialFiles, stubs: false });
  const post = useCallback(() => {
    const { rev, files: f, stubs } = onScreen.current;
    frame.current?.contentWindow?.postMessage({ source: "tl-builder", type: "files", rev, files: f, stubs }, "*");
  }, []);
  useEffect(() => {
    const stubs = draft !== null && !viewing;
    if (onScreen.current.files === shown && onScreen.current.stubs === stubs) return;
    onScreen.current = { rev: onScreen.current.rev + 1, files: shown, stubs };
    post();
  }, [shown, draft, viewing, post]);

  useEffect(() => {
    void fetch("/api/organizations/ai-key")
      .then((r) => r.json())
      .then((b: { key: SavedKey | null; canManage: boolean }) => {
        setKey(b.key);
        setCanManage(b.canManage);
      })
      .catch(() => setKey(null));
  }, []);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [messages, live]);

  // A running clock while the AI writes, so waiting feels like progress.
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const send = useCallback(
    async (text: string, opts: { hidden?: boolean } = {}) => {
      const message = text.trim();
      if (!message || busy) return;
      if (!opts.hidden) autoFixes.current = 0;
      const history = messages.filter((m) => !m.error).slice(-6).map(({ role, content }) => ({ role, content }));
      setMessages((m) => [...m, { role: "user", content: opts.hidden ? "The preview hit an error. Fixing it…" : message }]);
      setInput("");
      setBusy(true);
      setElapsed(0);
      setViewing(null);
      setLive({ reply: "", written: [], writing: [] });
      setTab("chat");
      try {
        const res = await fetch(`/api/apps/${appId}/code-chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history }) });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string; needsKey?: boolean };
          if (body.needsKey) setKey(null);
          setMessages((m) => [...m, { role: "assistant", content: body.error ?? "Something went wrong. Try again.", error: true }]);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        let lastPaint = 0;
        let lastDraft = 0;
        let lastShape = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          text += chunk;
          // Update the screen about 8 times a second, not for every few characters, but never skip the end of a file:
          // the AI can go quiet right after one (a first build waits for its sections), and the preview should show it now.
          const now = Date.now();
          if (now - lastPaint < 120 && !chunk.includes("</file>") && !chunk.includes("<writing")) continue;
          lastPaint = now;
          const { main, streams } = demux(splitStream(text).answer);
          const parsed = parseReply(main);
          setLive({
            reply: parsed.reply,
            written: [...new Set([...Object.keys(parsed.changes), ...parsed.edits.map((e) => e.path)])],
            writing: [...new Set([...parsed.writing, ...parsed.incomplete.slice(-1)])],
          });

          // The preview shows the app as far as it's written: finished files and edits, plus every file still being
          // typed, cut where it can run and closed up (a section appears line by line as the AI writes it).
          if (now - lastDraft < 200) continue;
          const whole = Object.fromEntries(Object.entries(parsed.changes).filter((e): e is [string, string] => typeof e[1] === "string"));
          const typing: Record<string, string> = {};
          for (const [path, body] of Object.entries(parsed.partial)) {
            const code = runnablePartial(path, body);
            if (code) typing[path] = code;
          }
          for (const [path, stream] of Object.entries(streams)) {
            if (path in whole) continue;
            const body = streamedBody(stream);
            const code = body === null ? null : runnablePartial(path, body);
            if (code) typing[path] = code;
          }
          const fresh = isFreshApp(filesRef.current);
          const visible = fresh || Object.keys(whole).some((path) => path !== SHARED_PATH) || Object.keys(typing).length > 0 || parsed.edits.length > 0;
          if (!visible) continue;
          const next = { ...applyEdits(applyChanges(filesRef.current, whole), parsed.edits).files, ...typing };
          if (fresh && !whole["src/App.jsx"] && !typing["src/App.jsx"]) {
            next["src/App.jsx"] = stackedApp([...main.matchAll(/<writing\s+path="([^"]+)"/g)].map((m) => m[1] as string));
          }
          const nextShape = shape(next);
          if (nextShape === lastShape || !next["src/App.jsx"]) continue;
          lastShape = nextShape;
          lastDraft = now;
          setDraft(next);
        }
        const { answer, result } = splitStream(text);
        const parsed = parseReply(answer);
        if (!result || result.error) {
          setMessages((m) => [...m, { role: "assistant", content: result?.error ?? "The connection dropped before the AI finished. Try again.", error: true }]);
          return;
        }
        if (result.files && result.version) {
          builtThisSession.current = true;
          setPreviewError(null);
          setFiles(result.files);
          setVersion(result.version);
          setVersions((v) => [{ version: result.version as number, summary: opts.hidden ? "Fixed an error" : message.replace(/\s+/g, " ").slice(0, 90), created_at: new Date().toISOString() }, ...v]);
          // New database setup to run: say so right away.
          if (Object.keys(result.files).some((p) => p.startsWith("db/"))) {
            void loadDb().then((next) => {
              const todo = next?.sql.filter((f) => !f.ran).length ?? 0;
              if (todo > 0 && next?.backend) toast("This change needs a database update", { description: "Open Database, copy the setup and run it in Supabase.", action: { label: "Open", onClick: () => setDbOpen(true) } });
            });
          }
        }
        const count = result.changed?.length ?? 0;
        setMessages((m) => [...m, { role: "assistant", content: result.reply || parsed.reply || "Done.", note: count ? `Updated ${count} file${count === 1 ? "" : "s"}` : result.note }]);
      } catch {
        setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the server. Check your connection and try again.", error: true }]);
      } finally {
        setBusy(false);
        setLive(null);
        setDraft(null);
      }
    },
    [appId, busy, messages, loadDb]
  );

  // Messages from the preview frame: it tells us when the app started and when it hit an error.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow || !e.data || e.data.source !== "tl-app") return;
      // The app keeping a sign-in (see the runtime's storage bridge).
      if (e.data.type === "storage") {
        const { op, key, value, id } = e.data as { op: string; key: string; value: string | null; id: string };
        const store = previewStorage.current;
        if (op === "set" && typeof value === "string") store.set(key, value);
        if (op === "remove") store.delete(key);
        frame.current?.contentWindow?.postMessage({ source: "tl-host", type: "storage-reply", id, value: op === "get" ? store.get(key) ?? null : null }, "*");
        return;
      }
      // The page (re)loaded: give it the version that should be on screen, in case it missed it while loading.
      if (e.data.type === "booted") {
        if (onScreen.current.rev > 0) post();
        return;
      }
      // Only news about the version on screen counts, and a half-written app's errors aren't real errors yet.
      if (e.data.rev !== onScreen.current.rev || onScreen.current.stubs) return;
      if (e.data.type === "ready") setPreviewError(null);
      if (e.data.type === "error") {
        const message = String(e.data.message ?? "Unknown error").slice(0, 1200);
        setPreviewError(message);
        // The AI wrote this version, so let it fix its own mistake (twice at most, and never the same error twice).
        if (!busy && !viewing && builtThisSession.current && autoFixes.current < MAX_AUTO_FIXES && lastFixedError.current !== message) {
          autoFixes.current += 1;
          lastFixedError.current = message;
          void send(`ERROR IN PREVIEW: ${message}`, { hidden: true });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [busy, viewing, send, post]);

  async function viewVersion(v: number) {
    if (v === version) return setViewing(null);
    const { data } = await supabase.from("app_code_versions").select("files").eq("app_id", appId).eq("version", v).maybeSingle();
    if (!data) return toast.error("Couldn't load that version");
    setPreviewError(null);
    setViewing({ version: v, files: data.files as Record<string, string> });
    setTab("preview");
  }

  async function restore() {
    if (!viewing) return;
    const res = await fetch(`/api/apps/${appId}/code/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: viewing.version }) });
    const body = (await res.json()) as { version?: number; files?: Record<string, string>; error?: string };
    if (!res.ok || !body.files || !body.version) return toast.error(body.error ?? "Couldn't restore");
    setPreviewError(null);
    setFiles(body.files);
    setVersion(body.version);
    setVersions((v) => [{ version: body.version as number, summary: `Restored version ${viewing.version}`, created_at: new Date().toISOString() }, ...v]);
    setViewing(null);
    toast.success(`Restored version ${viewing.version}`);
  }

  async function publish(next: "published" | "draft") {
    setPublishing(true);
    try {
      const res = await fetch(`/api/apps/${appId}/code/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const body = (await res.json()) as { app?: { status: "draft" | "published"; code_published_version: number | null }; error?: string };
      if (!res.ok || !body.app) return toast.error(body.error ?? "Couldn't update");
      setStatus(body.app.status);
      setPublished(body.app.code_published_version);
      toast.success(next === "published" ? "Published" : "Unpublished");
    } finally {
      setPublishing(false);
    }
  }

  const liveUrl = `//${slug}.${rootDomain}`;
  const hasUnpublished = status === "published" && published !== null && published < version;

  return (
    <div className="dark flex h-[calc(100dvh-4rem)] min-h-[560px] flex-col bg-neutral-950 text-neutral-100">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
        <Link href="/dashboard" aria-label="All apps" className="grid h-11 w-11 place-items-center rounded-full text-neutral-300 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{appName}</p>
          <p className="text-xs text-neutral-400">
            {status === "published" ? (
              <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                Live, version {published} <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : (
              "Draft, not published"
            )}
          </p>
        </div>
        <label className="sr-only" htmlFor="version-select">
          Version
        </label>
        <div className="relative">
          <History className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <select
            id="version-select"
            value={viewing?.version ?? version}
            onChange={(e) => void viewVersion(Number(e.target.value))}
            className="h-11 max-w-[11rem] rounded-full bg-white/[0.06] pl-11 pr-3 text-sm outline-none ring-1 ring-white/10 sm:max-w-xs"
          >
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version}
                {v.version === version ? " (latest)" : ""}
                {v.summary ? ` · ${v.summary.slice(0, 40)}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setDbOpen(true)}
          className="relative inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-neutral-200 ring-1 ring-white/15 hover:bg-white/10"
          aria-label={`Database${db?.backend ? ", connected" : ""}${db?.sql.some((f) => !f.ran) ? `, ${db.sql.filter((f) => !f.ran).length} setup to run` : ""}`}
        >
          <Database className="h-4 w-4" />
          <span className="hidden md:inline">Database</span>
          {db?.backend && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
          {!!db?.sql.filter((f) => !f.ran).length && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-neutral-950">{db.sql.filter((f) => !f.ran).length}</span>
          )}
        </button>
        <div className="hidden rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 sm:flex" role="group" aria-label="Preview size">
          {(["phone", "desktop"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm ${device === d ? "bg-white text-neutral-950" : "text-neutral-300"}`}>
              {d === "phone" ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />} {d === "phone" ? "Phone" : "Desktop"}
            </button>
          ))}
        </div>
        {status === "published" && (
          <button type="button" disabled={publishing} onClick={() => void publish("draft")} className="h-11 rounded-full px-4 text-sm font-semibold text-neutral-300 ring-1 ring-white/15 hover:bg-white/10 disabled:opacity-50">
            Unpublish
          </button>
        )}
        <button type="button" disabled={publishing || busy || takenDown !== null} onClick={() => void publish("published")} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-50 disabled:opacity-50">
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} {hasUnpublished ? "Publish update" : status === "published" ? "Republish" : "Publish"}
        </button>
      </div>

      <div className="flex border-b border-white/10 lg:hidden" role="tablist">
        {(["chat", "preview"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-11 flex-1 text-sm font-semibold ${tab === t ? "border-b-2 border-indigo-400 text-white" : "text-neutral-400"}`}>
            {t === "chat" ? "Chat" : "Preview"}
          </button>
        ))}
      </div>

      {takenDown !== null && (
        <div role="alert" className="border-b border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">
          <b>TapAndLaunch took this app down</b>
          {takenDown ? `: ${takenDown}` : "."} It isn&apos;t shown to visitors and can&apos;t be published. Questions? Email{" "}
          <a href="mailto:support@tapandlaunch.com" className="underline">
            support@tapandlaunch.com
          </a>
          .
        </div>
      )}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[420px_1fr]">
        <section className={`${tab === "chat" ? "flex" : "hidden"} min-h-0 flex-col border-white/10 lg:flex lg:border-r`} aria-label="Chat">
          {key === undefined ? (
            <div className="grid flex-1 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
            </div>
          ) : key === null ? (
            <div className="flex-1 overflow-y-auto">
              <KeyForm canManage={canManage} onSaved={setKey} />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && !live && (
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-300">
                      Describe the app you want. I&apos;ll write it, show it live, and keep improving it as you ask. Using <span className="text-white">{key.model}</span> with your key {key.hint}.
                    </p>
                    {CODE_EXAMPLES.map((ex) => (
                      <button key={ex} type="button" disabled={busy} onClick={() => void send(ex)} className="min-h-11 w-full rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-left text-sm text-neutral-200 transition hover:bg-white/10">
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-indigo-500 text-white" : m.error ? "bg-red-500/15 text-red-200" : "bg-white/[0.07]"}`}>
                      {m.content}
                      {m.note && <p className="mt-1 text-xs text-emerald-300">{m.note}</p>}
                    </div>
                  </div>
                ))}
                {live && (
                  <div className="flex justify-start">
                    <div className="max-w-[88%] space-y-2 rounded-2xl bg-white/[0.07] px-3.5 py-2.5 text-sm leading-relaxed">
                      {live.reply ? <p>{live.reply}</p> : <p className="flex items-center gap-2 text-neutral-400"><Loader2 className="h-4 w-4 animate-spin" /> Thinking… {elapsed}s</p>}
                      {live.written.map((p) => (
                        <p key={p} className="flex items-center gap-2 font-mono text-xs text-emerald-300"><FileCode2 className="h-3.5 w-3.5" /> {p}</p>
                      ))}
                      {live.writing.map((p) => (
                        <p key={p} className="flex items-center gap-2 font-mono text-xs text-indigo-200"><Loader2 className="h-3.5 w-3.5 animate-spin" /> writing {p}…</p>
                      ))}
                      {live.reply && <p className="text-xs text-neutral-500">{elapsed}s</p>}
                    </div>
                  </div>
                )}
                <div ref={listEnd} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
                className="flex items-end gap-2 border-t border-white/10 p-3"
              >
                <label htmlFor="code-message" className="sr-only">
                  Message
                </label>
                <textarea
                  id="code-message"
                  rows={2}
                  maxLength={4000}
                  value={input}
                  disabled={busy}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  placeholder={messages.length ? "Ask for a change…" : "Describe your app…"}
                  className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-sm outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-indigo-400/50 disabled:opacity-50"
                />
                <DictationButton large value={input} onChange={setInput} disabled={busy} maxLength={4000} onDone={(text) => void send(text)} />
                <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-neutral-950 disabled:opacity-40">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
                </button>
              </form>
            </>
          )}
        </section>

        <section className={`${tab === "preview" ? "flex" : "hidden"} min-h-0 flex-col lg:flex`} aria-label="Preview">
          {viewing && (
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
              <span>Viewing version {viewing.version}.</span>
              <button type="button" onClick={() => void restore()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-neutral-950">
                <RotateCcw className="h-3.5 w-3.5" /> Restore this version
              </button>
              <button type="button" onClick={() => setViewing(null)} className="min-h-9 text-xs font-semibold underline">
                Back to latest
              </button>
            </div>
          )}
          {previewError && !viewing && !busy && (
            <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              <Wrench className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">The preview hit an error: {previewError.split("\n")[0]}</span>
              {!busy && (
                <button type="button" onClick={() => void send(`ERROR IN PREVIEW: ${previewError}`, { hidden: true })} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-neutral-950">
                  Ask AI to fix it
                </button>
              )}
            </div>
          )}
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.18),transparent_60%)] p-3 sm:p-6">
            <div className={`h-full w-full overflow-hidden bg-white shadow-2xl ring-1 ring-white/10 ${device === "phone" ? "max-w-[390px] rounded-[2rem] border-[10px] border-neutral-900" : "rounded-xl"}`}>
              <iframe ref={frame} title="App preview" srcDoc={srcDoc} sandbox="allow-scripts allow-forms allow-popups allow-modals" className="h-full w-full border-0 bg-white" />
            </div>
          </div>
          {busy && (
            <p className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-xs text-neutral-400">
              <Sparkles className="h-3.5 w-3.5" /> The preview fills in as each part is written.
            </p>
          )}
        </section>
      </div>
      {dbOpen && (
        <DatabasePanel
          appId={appId}
          state={db}
          onClose={() => setDbOpen(false)}
          onState={setDb}
          onConnected={({ files: connected, version: v }) => {
            setFiles(connected);
            setVersion(v);
            setVersions((list) => [{ version: v, summary: "Connected a database", created_at: new Date().toISOString() }, ...list]);
          }}
        />
      )}
    </div>
  );
}
