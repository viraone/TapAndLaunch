"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";

export interface DeletedApp {
  id: string;
  name: string;
  slug: string;
  /** Whole days left to restore it. */
  daysLeft: number;
}

/** Apps deleted in the last 30 days, each with a Restore button. Only shown to admins, and only when there are some. */
export function RecentlyDeleted({ apps, rootDomain }: { apps: DeletedApp[]; rootDomain: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function restore(app: DeletedApp) {
    setBusyId(app.id);
    try {
      const res = await fetch(`/api/apps/${app.id}/restore`, { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't restore the app");
        return;
      }
      toast.success(`${app.name} is back, as a draft. Publish it when you're ready.`);
      router.refresh();
    } catch {
      toast.error("Couldn't restore the app");
    } finally {
      setBusyId(null);
    }
  }

  if (apps.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-neutral-950">Recently deleted</h2>
      <p className="mt-0.5 text-sm text-neutral-500">Restore an app within 30 days of deleting it. After that it is erased for good.</p>
      <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        {apps.map((app) => (
          <li key={app.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-950">{app.name}</p>
              <p className="truncate text-xs text-neutral-500">
                {app.slug}.{rootDomain} · {app.daysLeft} {app.daysLeft === 1 ? "day" : "days"} left to restore
              </p>
            </div>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => restore(app)}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {busyId === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Restore
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
