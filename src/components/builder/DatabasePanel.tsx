"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Database, ExternalLink, Loader2, X } from "lucide-react";

export interface DbState {
  backend: { url: string; ref: string | null; sqlEditor: string | null } | null;
  sql: Array<{ path: string; sql: string; ran: boolean; changed: boolean }>;
}

/**
 * An AI-built app's own database: connect the owner's Supabase project (its URL and public key), then run the table
 * setup the AI writes, in the owner's own SQL editor. TapAndLaunch only ever holds the public key.
 */
export function DatabasePanel({
  appId,
  state,
  onClose,
  onConnected,
  onState,
}: {
  appId: string;
  state: DbState | null;
  onClose: () => void;
  onConnected: (result: { files: Record<string, string>; version: number }) => void;
  onState: (next: DbState) => void;
}) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [shown, setShown] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/apps/${appId}/backend`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, key }) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string; backend?: DbState["backend"]; confirmEmail?: boolean; files?: Record<string, string>; version?: number } | undefined;
    setBusy(false);
    if (!res?.ok || !body?.backend || !body.files || !body.version) return setError(body?.error ?? "Couldn't connect. Check your connection and try again.");
    setConfirmEmail(!!body.confirmEmail);
    setKey("");
    onState({ backend: body.backend, sql: state?.sql ?? [] });
    onConnected({ files: body.files, version: body.version });
    toast.success("Database connected. Ask the AI for anything that should be saved, or for sign-in.");
  }

  async function disconnect() {
    if (!confirm("Disconnect this database? The app's code stays, but the AI won't use the database for new changes. Your data stays in your Supabase project.")) return;
    setBusy(true);
    const res = await fetch(`/api/apps/${appId}/backend`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast.error("Couldn't disconnect. Try again.");
    onState({ backend: null, sql: state?.sql ?? [] });
  }

  async function mark(path: string, ran: boolean) {
    const res = await fetch(`/api/apps/${appId}/backend`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, ran }) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { sql?: DbState["sql"]; error?: string } | undefined;
    if (!res?.ok || !body?.sql) return toast.error(body?.error ?? "Couldn't save that. Try again.");
    onState({ backend: state?.backend ?? null, sql: body.sql });
  }

  async function copy(sql: string) {
    try {
      await navigator.clipboard.writeText(sql);
      toast.success("Copied. Paste it in your Supabase SQL editor and press Run.");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  }

  const backend = state?.backend ?? null;
  const sql = state?.sql ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-labelledby="db-title" onClick={onClose}>
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-neutral-950 text-neutral-100 shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Database className="h-5 w-5 text-indigo-300" />
          <h2 id="db-title" className="flex-1 text-lg font-semibold">
            Database
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-neutral-400 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-6 text-sm">
          {!backend ? (
            <form onSubmit={connect} className="space-y-4">
              <p className="text-neutral-300">
                Give this app a real database and sign-in with your own <b>Supabase</b> project (free to start). Your data stays in your project; TapAndLaunch only keeps its public key.
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-neutral-400">
                <li>
                  Create a project at{" "}
                  <a href="https://supabase.com/dashboard/new" target="_blank" rel="noreferrer" className="text-indigo-300 underline">
                    supabase.com
                  </a>
                  .
                </li>
                <li>In the project, open Project Settings, then API Keys. Copy the Project URL and the anon / publishable key.</li>
              </ol>
              <label className="block font-medium">
                Project URL
                <input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://abcdefgh.supabase.co" className="mt-1.5 h-12 w-full rounded-xl bg-white/[0.06] px-4 outline-none ring-1 ring-white/10 focus:ring-indigo-400/60" />
              </label>
              <label className="block font-medium">
                Public key (anon / publishable)
                <input value={key} onChange={(e) => setKey(e.target.value)} required placeholder="sb_publishable_… or eyJ…" autoComplete="off" className="mt-1.5 h-12 w-full rounded-xl bg-white/[0.06] px-4 font-mono text-xs outline-none ring-1 ring-white/10 focus:ring-indigo-400/60" />
              </label>
              <p className="text-xs text-neutral-500">Never paste the secret (service role) key here. It would be refused.</p>
              {error && (
                <p role="alert" className="rounded-xl bg-red-500/15 px-3 py-2 text-red-200">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-neutral-950 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Connect database
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="min-w-0 flex-1 truncate">
                  Connected to <b>{backend.ref ?? backend.url}</b>
                </span>
                <button type="button" onClick={() => void disconnect()} disabled={busy} className="h-11 rounded-full px-3 text-neutral-400 hover:text-white">
                  Disconnect
                </button>
              </div>
              {confirmEmail && (
                <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-amber-100">
                  New sign-ups must confirm their email first. While you test, you can turn that off in Supabase: Authentication, Sign In / Providers, Email, &ldquo;Confirm email&rdquo;. Also set Authentication, URL Configuration, Site URL to your app&apos;s address.
                </p>
              )}
              <p className="text-neutral-400">Now ask the AI for anything that should be saved (&ldquo;save tasks to the database&rdquo;) or for sign-in (&ldquo;let people make an account&rdquo;).</p>
            </div>
          )}

          <section aria-labelledby="setup-title" className="space-y-3">
            <h3 id="setup-title" className="font-semibold">
              Database setup
            </h3>
            {sql.length === 0 ? (
              <p className="text-neutral-400">When the AI creates tables, their setup appears here for you to run in your Supabase SQL editor.</p>
            ) : (
              <ul className="space-y-3">
                {sql.map((f) => (
                  <li key={f.path} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="flex-1 font-mono text-xs text-neutral-200">{f.path}</code>
                      {f.ran ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                          <Check className="h-3.5 w-3.5" /> Ran
                        </span>
                      ) : f.changed ? (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">Changed since you ran it</span>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">Not run yet</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void copy(f.sql)} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-neutral-950">
                        <Copy className="h-3.5 w-3.5" /> Copy SQL
                      </button>
                      {backend?.sqlEditor && (
                        <a href={backend.sqlEditor} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-neutral-200 ring-1 ring-white/15 hover:bg-white/10">
                          Open SQL editor <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {backend && (
                        <button type="button" onClick={() => void mark(f.path, !f.ran)} className="h-11 rounded-full px-4 text-xs font-semibold text-neutral-300 ring-1 ring-white/15 hover:bg-white/10">
                          {f.ran ? "Mark as not run" : "I ran it"}
                        </button>
                      )}
                      <button type="button" onClick={() => setShown(shown === f.path ? null : f.path)} className="h-11 rounded-full px-3 text-xs text-neutral-400 hover:text-white">
                        {shown === f.path ? "Hide" : "Show"} SQL
                      </button>
                    </div>
                    {shown === f.path && <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-neutral-300">{f.sql}</pre>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
