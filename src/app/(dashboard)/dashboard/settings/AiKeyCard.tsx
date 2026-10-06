"use client";

import { useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { SettingsSection } from "./SettingsSection";

interface SavedKey {
  provider: "anthropic" | "openai";
  hint: string;
  model: string;
}

const LABEL = { anthropic: "Anthropic (Claude)", openai: "OpenAI (ChatGPT)" } as const;

/** "BYOB: Bring your own bot": which AI key this organization builds with, and a way to remove it. */
export function AiKeyCard({ initialKey, canManage }: { initialKey: SavedKey | null; canManage: boolean }) {
  const [key, setKey] = useState(initialKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Remove this AI key? Building by chat stops until a key is added again.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations/ai-key", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setKey(null);
    } catch {
      setError("Couldn't remove the key. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection icon={Bot} title="AI key" description="Bring your own bot: build apps by chatting, billed to your own AI account">
      {key ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <p className="font-semibold text-emerald-800">{LABEL[key.provider]} key {key.hint} is saved</p>
            <p className="mt-1 text-sm text-emerald-900/80">
              Building with <span className="font-mono text-[13px]">{key.model}</span>. A BYOB app builds from its chat; in any other app, click <span className="font-semibold">Build with AI</span> in the builder. The key is stored encrypted and is never shown again.
            </p>
          </div>
          {canManage && (
            <button type="button" onClick={remove} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-5 text-sm font-semibold text-neutral-900 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Remove key
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-600">
          No key yet. Create a <span className="font-semibold">BYOB: Bring your own bot</span> app, or click <span className="font-semibold">Build with AI</span> in any app&apos;s builder, and paste a key from Anthropic (Claude) or OpenAI (ChatGPT). You pay your AI provider directly, usually a few cents per change.
          {!canManage && " Only an organization admin can add one."}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </SettingsSection>
  );
}
