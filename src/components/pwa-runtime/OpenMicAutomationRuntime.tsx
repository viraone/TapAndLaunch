"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Loader2, Lock } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { syncChatTabs } from "@/lib/openmic/host-chat";
import {
  describeSchedule,
  formatInstant,
  peopleLabel,
  summarizeRecent,
  type AutomationReminder,
  type AutomationState,
} from "@/lib/automation/ui";
import { useOpenMicClient } from "./OpenMicSignupRuntime";
import { AUTOMATION_BASE, automationError, automationFetch } from "./automation-api";
import { AutomationConfirmDialog } from "./AutomationDialog";
import { AutomationEditor } from "./AutomationEditor";
import { AutomationGmailCard } from "./AutomationGmailCard";

const MAX_REMINDERS = 10;

/** The one line each possible `?gmail=` result deserves. */
const GMAIL_MESSAGES: Record<string, string> = {
  connected: "Gmail is connected.",
  cancelled: "You closed Google's screen before finishing.",
  missing_permission:
    "Google didn't give permission to send email. Connect again and leave that box ticked.",
  failed: "That didn't work. Please try again.",
};

const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition active:scale-[0.99] disabled:opacity-40";
const SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-muted px-4 text-base font-semibold transition active:scale-[0.99] disabled:opacity-40";

/**
 * StageTime's Automation tab (block view "automation"), for the one address listed in the block's
 * `automation_emails`. The owner connects their Gmail, chooses who gets each reminder, writes it, tests it and
 * switches it on. Every route behind this screen checks the caller again; this component only decides what to draw.
 */
export function OpenMicAutomationRuntime({
  config,
}: {
  config: OpenMicSignupBlockConfig;
}) {
  const client = useOpenMicClient(config);
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const check = (who: User | null) => {
      if (cancelled) return;
      setUser(who);
      void syncChatTabs(client, who);
    };
    void client.auth.getSession().then(({ data }) => {
      if (!cancelled) check(data.session?.user ?? null);
    });
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") check(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  const signedOut = useCallback(() => setUser(null), []);

  if (!client) {
    return (
      <p className="mx-4 my-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        The Automation screen isn&apos;t connected yet.
      </p>
    );
  }
  if (user === undefined) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading Automation">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return (
      <AutomationNotice title="Sign in to set up reminders">
        <Link
          href="/profile"
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-primary/15 text-base font-bold text-primary"
        >
          Sign in
        </Link>
      </AutomationNotice>
    );
  }
  return (
    <AutomationScreen client={client} config={config} onSignedOut={signedOut} />
  );
}

function AutomationNotice({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <h1 className="text-3xl font-black tracking-tight">Automation</h1>
      <div className="mt-6 flex flex-col items-center rounded-2xl border bg-muted/60 px-6 py-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-xl font-bold">{title}</p>
        {children}
      </div>
    </div>
  );
}

function AutomationScreen({
  client,
  config,
  onSignedOut,
}: {
  client: SupabaseClient;
  config: OpenMicSignupBlockConfig;
  onSignedOut: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "private" | "failed">(
    "loading"
  );
  const [state, setState] = useState<AutomationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ reminder: AutomationReminder | null } | null>(
    null
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [confirmEnable, setConfirmEnable] = useState<AutomationReminder | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await automationFetch(client, AUTOMATION_BASE);
      if (!result.ok || result.response.status === 401) {
        onSignedOut();
        return;
      }
      if (result.response.status === 403) {
        setStatus("private");
        return;
      }
      if (!result.response.ok) {
        setError(
          await automationError(result.response, "Could not load the screen. Try again.")
        );
        setStatus("failed");
        return;
      }
      const body = (await result.response.json()) as AutomationState;
      setState(body);
      setStatus("ready");
    } catch {
      setError("Could not load the screen. Check your connection and try again.");
      setStatus("failed");
    }
  }, [client, onSignedOut]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // A return from Google carries ?gmail=connected|cancelled|missing_permission|failed. Say what happened once, then
  // take the parameter out of the address so a refresh does not say it again. The message is set on a later tick so
  // this effect does not cascade a render; without the parameter there is nothing left to say on a second run.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    if (!result) return;
    params.delete("gmail");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );
    const message = GMAIL_MESSAGES[result] ?? null;
    window.setTimeout(() => setNotice(message), 0);
  }, []);

  async function applyEnabled(reminder: AutomationReminder, enabled: boolean) {
    if (busyId) return;
    setBusyId(reminder.id);
    setActionErrors((previous) => {
      const next = { ...previous };
      delete next[reminder.id];
      return next;
    });
    try {
      const result = await automationFetch(
        client,
        `${AUTOMATION_BASE}/reminders/enabled`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: reminder.id, enabled }),
        }
      );
      if (!result.ok || result.response.status === 401) {
        onSignedOut();
        return;
      }
      if (!result.response.ok) {
        const text = await automationError(
          result.response,
          "Could not change the reminder. Try again."
        );
        setActionErrors((previous) => ({ ...previous, [reminder.id]: text }));
        return;
      }
      setState((previous) =>
        previous
          ? {
              ...previous,
              reminders: previous.reminders.map((entry) =>
                entry.id === reminder.id ? { ...entry, enabled } : entry
              ),
            }
          : previous
      );
    } catch {
      setActionErrors((previous) => ({
        ...previous,
        [reminder.id]: "Could not change the reminder. Check your connection and try again.",
      }));
    } finally {
      setBusyId(null);
      setConfirmEnable(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading Automation">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "private") {
    return <AutomationNotice title="This screen is private." />;
  }

  if (status === "failed" || !state) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
        <h1 className="text-3xl font-black tracking-tight">Automation</h1>
        <p role="alert" className="mt-4 text-base text-red-400">
          {error ?? "Could not load the screen. Try again."}
        </p>
        <button type="button" onClick={() => void load()} className={`${SECONDARY} mt-4`}>
          Try again
        </button>
      </div>
    );
  }

  const gmail = state.gmail;
  const canRun = gmail.connected && gmail.canSend && !gmail.needsReconnect;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <h1 className="text-3xl font-black tracking-tight">Automation</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Reminders for your comics, sent from your own Gmail.
      </p>

      <AutomationGmailCard
        client={client}
        gmail={gmail}
        onChanged={() => void load()}
        onSignedOut={onSignedOut}
      />

      {notice && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {!canRun ? (
        gmail.configured && (
          <p className="mt-3 text-sm text-muted-foreground">
            Connect Gmail to set up reminders.
          </p>
        )
      ) : (
        <>
          <div className="mt-6 flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold">Reminders</h2>
            <button
              type="button"
              onClick={() => setEditing({ reminder: null })}
              disabled={state.reminders.length >= MAX_REMINDERS}
              className={`${PRIMARY} px-3`}
            >
              New reminder
            </button>
          </div>
          {state.reminders.length >= MAX_REMINDERS && (
            <p className="mt-1 text-sm text-muted-foreground">
              You can keep up to 10 reminders.
            </p>
          )}

          {state.reminders.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-muted/60 p-6 text-center">
              <p className="text-base font-semibold">No reminders yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Write one, pick the people, and it sends itself before the show.
              </p>
              <button
                type="button"
                onClick={() => setEditing({ reminder: null })}
                className={`${PRIMARY} mt-4`}
              >
                Create your first reminder
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {state.reminders.map((reminder) => (
                <article
                  key={reminder.id}
                  className="rounded-2xl border bg-muted/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-bold">{reminder.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {describeSchedule(reminder)} · {peopleLabel(reminder.recipients.length)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Next:{" "}
                        {reminder.nextSendAt
                          ? formatInstant(reminder.nextSendAt, state.timeZone)
                          : "Not scheduled"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold">
                        {reminder.enabled ? "On" : "Off"}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={reminder.enabled}
                        aria-label={`${reminder.name}: ${reminder.enabled ? "on" : "off"}`}
                        disabled={busyId === reminder.id}
                        onClick={() => {
                          if (reminder.enabled) void applyEnabled(reminder, false);
                          else setConfirmEnable(reminder);
                        }}
                        className="relative flex h-11 w-14 shrink-0 items-center disabled:opacity-40"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-7 w-12 rounded-full transition ${
                            reminder.enabled ? "bg-primary" : "bg-foreground/20"
                          }`}
                        />
                        <span
                          aria-hidden="true"
                          className={`absolute left-0.5 h-6 w-6 rounded-full bg-background shadow transition ${
                            reminder.enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditing({ reminder })}
                    className={`${SECONDARY} mt-3`}
                  >
                    Edit
                  </button>

                  {actionErrors[reminder.id] && (
                    <p role="alert" className="mt-2 text-sm text-red-400">
                      {actionErrors[reminder.id]}
                    </p>
                  )}

                  {reminder.recent.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                        Recent sends
                      </summary>
                      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {reminder.recent.map((send) => (
                          <li key={send.occurrence_at}>
                            {formatInstant(send.occurrence_at, state.timeZone)} ·{" "}
                            {summarizeRecent(send)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <AutomationEditor
          key={editing.reminder?.id ?? "new"}
          client={client}
          reminder={editing.reminder}
          state={state}
          showWeekday={config.opens_weekday ?? 5}
          onSaved={(saved) =>
            setState((previous) => {
              if (!previous) return previous;
              const exists = previous.reminders.some((entry) => entry.id === saved.id);
              return {
                ...previous,
                reminders: exists
                  ? previous.reminders.map((entry) =>
                      entry.id === saved.id ? saved : entry
                    )
                  : [...previous.reminders, saved],
              };
            })
          }
          onDeleted={(id) => {
            setState((previous) =>
              previous
                ? {
                    ...previous,
                    reminders: previous.reminders.filter((entry) => entry.id !== id),
                  }
                : previous
            );
            setEditing(null);
          }}
          onToggled={(id, enabled) =>
            setState((previous) =>
              previous
                ? {
                    ...previous,
                    reminders: previous.reminders.map((entry) =>
                      entry.id === id ? { ...entry, enabled } : entry
                    ),
                  }
                : previous
            )
          }
          onSignedOut={onSignedOut}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmEnable && (
        <AutomationConfirmDialog
          title="Turn on this reminder?"
          message={`Turn on ${confirmEnable.name}? ${peopleLabel(
            confirmEnable.recipients.length
          )} will get this ${describeSchedule(confirmEnable).toLowerCase()}. Replies go to ${
            gmail.email ?? "your Gmail"
          }.`}
          confirmLabel="Turn on"
          busy={busyId === confirmEnable.id}
          onConfirm={() => void applyEnabled(confirmEnable, true)}
          onClose={() => setConfirmEnable(null)}
        />
      )}
    </div>
  );
}
