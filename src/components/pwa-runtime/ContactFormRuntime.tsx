"use client";

import { useState } from "react";
import type { ContactFormBlockConfig } from "@/types/database";

/**
 * The only interactive block in the runtime — everything else
 * (`BlockRenderer`) is a plain server-rendered view. Split out as its own
 * Client Component "island" rather than making the whole renderer client
 * side, so text/image/video stay simple server-rendered output.
 *
 * `pageId` is undefined when rendered outside the published-app runtime
 * (the builder's canvas preview) — submission is disabled in that case
 * rather than posting to a route that doesn't apply to it. In the builder
 * this never actually matters in practice: `SortableBlockItem` wraps the
 * whole block in `pointer-events-none`, so the form can't be clicked either
 * way — this is a second, independent guard against submitting from
 * somewhere it shouldn't.
 */
export function ContactFormRuntime({
  config,
  pageId,
}: {
  config: ContactFormBlockConfig;
  pageId?: string;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pageId) return;

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    setStatus("submitting");
    try {
      const res = await fetch("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, data }),
      });
      setStatus(res.ok ? "submitted" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <div className="mx-4 my-2 rounded-md border p-4 text-center text-sm text-muted-foreground">
        Thanks — your message was sent.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-4 my-2 space-y-3 rounded-md border p-4">
      {config.title && <h3 className="font-medium">{config.title}</h3>}
      {(config.fields ?? []).map((field) => (
        <div key={field.name} className="space-y-1">
          <label className="text-sm font-medium">{field.label}</label>
          {field.type === "textarea" ? (
            <textarea
              name={field.name}
              required={field.required}
              className="w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
            />
          ) : (
            <input
              name={field.name}
              type={field.type}
              required={field.required}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          )}
        </div>
      ))}
      {status === "error" && (
        <p className="text-sm text-destructive">Something went wrong — please try again.</p>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {status === "submitting" ? "Sending…" : (config.submit_label ?? "Submit")}
      </button>
    </form>
  );
}
