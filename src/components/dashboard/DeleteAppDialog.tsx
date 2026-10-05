"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { APP_RESTORE_DAYS, confirmationMatches } from "@/lib/apps/deletion";

const OPEN_EVENT = "open-delete-app";

/** The red "Delete app" row in an app card's menu. It only asks the card's dialog (below) to open. */
export function DeleteAppMenuItem({ appId }: { appId: string }) {
  return (
    <DropdownMenuItem variant="destructive" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { appId } }))}>
      <Trash2 /> Delete app
    </DropdownMenuItem>
  );
}

/**
 * Confirms deleting an app: says what would be lost, and asks for the app's name to be typed. Deleting hides the
 * app at once and erases it after 30 days, and an admin can restore it until then.
 */
export function DeleteAppDialog({ appId, appName }: { appId: string; appName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [losses, setLosses] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      if ((e as CustomEvent<{ appId: string }>).detail?.appId !== appId) return;
      setTyped("");
      setError(null);
      setLosses(null);
      setOpen(true);
      void fetch(`/api/apps/${appId}/deletion-summary`)
        .then((r) => (r.ok ? (r.json() as Promise<{ losses: string[] }>) : null))
        .then((body) => setLosses(body?.losses ?? []))
        .catch(() => setLosses([]));
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [appId]);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: typed }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Try again.");
        return;
      }
      setOpen(false);
      toast.success(`${appName} was deleted. You can restore it for ${APP_RESTORE_DAYS} days.`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const ready = confirmationMatches(typed, appName);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {appName}?</DialogTitle>
          <DialogDescription>
            The app stops working right away and disappears from your list. You can restore it for {APP_RESTORE_DAYS} days; after that it is erased for good.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-950 ring-1 ring-red-200">
          <p className="font-semibold">What you&rsquo;d lose after {APP_RESTORE_DAYS} days</p>
          {losses === null ? (
            <p className="mt-1 text-red-900/70">Checking…</p>
          ) : (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-900/80">
              <li>All its pages and content</li>
              {losses.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>Its analytics, and its custom domain if it has one</li>
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`delete-confirm-${appId}`} className="block text-sm font-medium">
            Type <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[13px] text-neutral-900">{appName}</span> to confirm
          </label>
          <input
            id={`delete-confirm-${appId}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-11 w-full rounded-xl border border-input bg-transparent px-3.5 text-[15px] outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-100 px-5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={remove}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete app
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
