"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Switches Google Maps features on or off for one organization. */
export function MapsToggle({ organizationId, enabled, name }: { organizationId: string; enabled: boolean; name: string }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setOn(next);
    const res = await fetch(`/api/admin/organizations/${organizationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maps_enabled: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setOn(!next);
      toast.error("Couldn't change that. Try again.");
      return;
    }
    toast.success(`${next ? "Switched on" : "Switched off"} for ${name}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Google Maps features for ${name}`}
      disabled={busy}
      onClick={toggle}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${on ? "bg-emerald-500" : "bg-neutral-300"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
    </button>
  );
}
