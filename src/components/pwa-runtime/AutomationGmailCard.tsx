"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import type { AutomationGmail } from "@/lib/automation/ui";
import { AUTOMATION_BASE, automationError, automationFetch } from "./automation-api";
import { AutomationConfirmDialog } from "./AutomationDialog";

/**
 * The top of the Automation screen: connect, or see which Gmail account the reminders go out from. Connecting sends
 * the browser to Google; the callback comes back to this tab with a `gmail=` result in the address.
 */
export function AutomationGmailCard({
  client,
  gmail,
  onChanged,
  onSignedOut,
}: {
  client: SupabaseClient;
  gmail: AutomationGmail;
  /** Refetches the screen after the connection changes. */
  onChanged: () => void;
  onSignedOut: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function connect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await automationFetch(client, `${AUTOMATION_BASE}/connect`, {
        method: "POST",
      });
      if (!result.ok) {
        onSignedOut();
        return;
      }
      if (result.response.status === 401) {
        onSignedOut();
        return;
      }
      const body = (await result.response.json().catch(() => null)) as {
        url?: unknown;
        error?: unknown;
      } | null;
      if (!result.response.ok || typeof body?.url !== "string") {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not connect Gmail. Try again."
        );
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not connect Gmail. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await automationFetch(client, `${AUTOMATION_BASE}/connect`, {
        method: "DELETE",
      });
      if (!result.ok) {
        onSignedOut();
        return;
      }
      if (result.response.status === 401) {
        onSignedOut();
        return;
      }
      if (!result.response.ok) {
        setError(await automationError(result.response, "Could not disconnect. Try again."));
        return;
      }
      setConfirming(false);
      onChanged();
    } catch {
      setError("Could not disconnect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!gmail.configured) {
    return (
      <section className="mt-6 rounded-2xl border bg-muted/60 p-6">
        <h2 className="text-xl font-bold">Send from your Gmail</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Connecting Gmail isn&apos;t available yet.
        </p>
      </section>
    );
  }

  if (!gmail.connected || gmail.needsReconnect) {
    return (
      <section className="mt-6 rounded-2xl border bg-muted/60 p-6">
        <h2 className="text-xl font-bold">Send from your Gmail</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Connect the Gmail account your comics already know. Reminders go out from it, and
          replies come back to it. We never see your password.
        </p>
        {gmail.needsReconnect && (
          <p className="mt-2 text-sm font-semibold text-amber-500">
            Your Gmail connection ended. Connect again to keep reminders going.
          </p>
        )}
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Opening Google…" : "Connect Gmail"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border bg-muted/60 p-6">
      <h2 className="text-xl font-bold">Send from your Gmail</h2>
      <p className="mt-2 break-words text-sm text-muted-foreground">
        Connected as <span className="font-semibold text-foreground">{gmail.email}</span>
      </p>
      {!gmail.canSend && (
        <>
          <p className="mt-2 text-sm font-semibold text-amber-500">
            This Gmail can&apos;t send yet. Connect again and keep the email box ticked.
          </p>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Opening Google…" : "Connect Gmail"}
          </button>
        </>
      )}
      {gmail.canSend && !gmail.canReadOtherContacts && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            To pick from the people you&apos;ve emailed, reconnect Gmail and keep every box
            ticked.
          </p>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-muted px-4 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Opening Google…" : "Reconnect Gmail"}
          </button>
        </>
      )}
      {!gmail.canReadContacts && !gmail.canReadOtherContacts && (
        <p className="mt-2 text-sm text-muted-foreground">
          You didn&apos;t allow contacts, so you&apos;ll type email addresses by hand.
        </p>
      )}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="mt-3 text-sm font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-50"
      >
        Disconnect
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {confirming && (
        <AutomationConfirmDialog
          title="Disconnect Gmail?"
          message={`Disconnect ${gmail.email ?? "this Gmail account"}? Reminders stop until you connect again.`}
          confirmLabel="Disconnect"
          tone="danger"
          busy={busy}
          onConfirm={() => void disconnect()}
          onClose={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
