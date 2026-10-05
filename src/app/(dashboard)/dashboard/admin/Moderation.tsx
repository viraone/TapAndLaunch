"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Take an app down (with a reason the owner will see), restore it, or dismiss its open reports. */
export function ModerationActions({ appId, name, suspended, openReports }: { appId: string; name: string; suspended: boolean; openReports: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(body: Record<string, string>, done: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/apps/${appId}/moderation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      return toast.error(b.error ?? "Couldn't do that. Try again.");
    }
    toast.success(done);
    setAsking(false);
    setReason("");
    router.refresh();
  }

  if (asking) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act({ action: "takedown", reason }, `${name} was taken down`);
        }}
        className="flex w-full flex-wrap items-center gap-2"
      >
        <label className="sr-only" htmlFor={`reason-${appId}`}>
          Why (the owner sees this)
        </label>
        <input
          id={`reason-${appId}`}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={3}
          maxLength={300}
          required
          placeholder="Why (the owner sees this), e.g. it asks for bank logins"
          className="h-11 min-w-0 flex-1 rounded-full border border-neutral-300 px-4 text-sm outline-none focus:border-neutral-900"
        />
        <button type="submit" disabled={busy} className="h-11 rounded-full bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
          Take down
        </button>
        <button type="button" onClick={() => setAsking(false)} className="h-11 rounded-full px-3 text-sm font-medium text-neutral-600">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suspended ? (
        <button type="button" disabled={busy} onClick={() => void act({ action: "restore" }, `${name} was restored`)} className="h-11 rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-60">
          Restore
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => setAsking(true)} className="h-11 rounded-full bg-red-50 px-4 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-60">
          Take down…
        </button>
      )}
      {openReports > 0 && !suspended && (
        <button type="button" disabled={busy} onClick={() => void act({ action: "dismiss" }, "Reports dismissed")} className="h-11 rounded-full px-4 text-sm font-medium text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-60">
          Dismiss reports
        </button>
      )}
    </div>
  );
}
