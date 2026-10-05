"use client";

import { useState } from "react";
import { REPORT_REASON_LABELS, REPORT_REASONS } from "@/lib/moderation/labels";

export function ReportForm() {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError("Choose what's wrong with the app.");
    setState("sending");
    setError(null);
    const res = await fetch("/report/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, details, contact }) }).catch(() => null);
    if (res?.ok) return setState("sent");
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setError(body?.error ?? "Couldn't send the report. Check your connection and try again.");
    setState("idle");
  }

  if (state === "sent") {
    return (
      <div role="status" className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-semibold text-emerald-900">Thanks, your report was sent.</p>
        <p className="mt-1 text-sm text-emerald-800">We review every report. If the app breaks our rules, we take it down.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold">What&apos;s wrong?</legend>
        <div className="mt-3 space-y-2">
          {REPORT_REASONS.map((r) => (
            <label key={r} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${reason === r ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4" />
              {REPORT_REASON_LABELS[r]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">
        Anything that would help us (optional)
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-slate-900" />
      </label>
      <label className="block text-sm font-semibold">
        Your email, if we may follow up (optional)
        <input type="email" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-normal outline-none focus:border-slate-900" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className="h-12 w-full rounded-full bg-slate-900 font-semibold text-white disabled:opacity-60">
        {state === "sending" ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
