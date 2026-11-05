"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  describeSchedule,
  formatInstant,
  peopleLabel,
  summarizeRecent,
  type AutomationReminder,
  type SchedulingState,
} from "@/lib/automation/ui";
import { AutomationEditor } from "./AutomationEditor";
import { automationBase, automationError } from "./automation-api";

const MAX_REMINDERS = 10;
const BUTTON_CLASS = "h-11 px-4 sm:h-8";

/**
 * The dashboard's Automation screen: the owner's reminders as a list, each with the time it next goes out and its
 * own on/off switch, plus the editor that writes them. Gmail is the sender, so a connection that can't send hides
 * the list behind one card that points at the Reminders page, where connecting lives.
 */
export function AutomationManager({
  appId,
  appName,
}: {
  appId: string;
  appName: string;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [state, setState] = useState<SchedulingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ reminder: AutomationReminder | null } | null>(
    null
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [enableTarget, setEnableTarget] = useState<AutomationReminder | null>(null);
  const [enableError, setEnableError] = useState<string | null>(null);

  const base = automationBase(appId);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch(base);
      if (!response.ok) {
        setError(await automationError(response, "Could not load this screen. Try again."));
        setStatus("failed");
        return;
      }
      const body = (await response.json().catch(() => null)) as SchedulingState | null;
      if (!body || !Array.isArray(body.reminders)) {
        setError("Could not load this screen. Try again.");
        setStatus("failed");
        return;
      }
      setState(body);
      setStatus("ready");
    } catch {
      setError("Could not load this screen. Check your connection and try again.");
      setStatus("failed");
    }
  }, [base]);

  // Deferred by a tick so the first fetch never sets state synchronously inside the effect.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function clearActionError(id: string) {
    setActionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  async function applyEnabled(reminder: AutomationReminder, enabled: boolean) {
    if (busyId) return;
    setBusyId(reminder.id);
    clearActionError(reminder.id);
    setEnableError(null);
    try {
      const response = await fetch(`${base}/reminders/enabled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reminder.id, enabled }),
      });
      if (!response.ok) {
        const text = await automationError(
          response,
          "Could not change the message. Try again."
        );
        if (enabled) setEnableError(text);
        else setActionErrors((previous) => ({ ...previous, [reminder.id]: text }));
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
      setEnableTarget(null);
    } catch {
      const text = "Could not change the message. Check your connection and try again.";
      if (enabled) setEnableError(text);
      else setActionErrors((previous) => ({ ...previous, [reminder.id]: text }));
    } finally {
      setBusyId(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading automation">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "failed" || !state) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-600">
          {error ?? "Could not load this screen. Try again."}
        </p>
        <Button type="button" variant="outline" className={BUTTON_CLASS} onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  const gmail = state.gmail;
  const canRun = gmail.configured && gmail.connected && gmail.canSend && !gmail.needsReconnect;

  if (!canRun) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Connect Gmail first</CardTitle>
          <CardDescription>
            Messages go out from your own Gmail, and replies come back to it.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            href={`/dashboard/apps/${appId}/reminders`}
            className={buttonVariants({ className: BUTTON_CLASS })}
          >
            Go to Reminders to connect
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const atCap = state.reminders.length >= MAX_REMINDERS;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Messages</h2>
        <Button
          type="button"
          className={BUTTON_CLASS}
          disabled={atCap}
          onClick={() => setEditing({ reminder: null })}
        >
          New message
        </Button>
      </div>
      {atCap && (
        <p className="text-sm text-muted-foreground">You can keep up to 10 messages.</p>
      )}

      {state.reminders.length === 0 ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>No messages yet</CardTitle>
            <CardDescription>
              Write one, choose the people, and it sends itself on the day and time you pick.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              className={BUTTON_CLASS}
              onClick={() => setEditing({ reminder: null })}
            >
              Write your first message
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-3">
          {state.reminders.map((reminder) => (
            <Card key={reminder.id}>
              <CardHeader>
                <CardTitle className="break-words">{reminder.name}</CardTitle>
                <CardDescription>
                  {describeSchedule(reminder)} · {peopleLabel(reminder.recipients.length)}
                </CardDescription>
                <CardAction>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {reminder.enabled ? "On" : "Off"}
                    </span>
                    <Switch
                      checked={reminder.enabled}
                      disabled={busyId === reminder.id}
                      aria-label={`${reminder.name}: ${reminder.enabled ? "on" : "off"}`}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEnableError(null);
                          setEnableTarget(reminder);
                          return;
                        }
                        void applyEnabled(reminder, false);
                      }}
                    />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Next:{" "}
                  {reminder.nextSendAt
                    ? formatInstant(reminder.nextSendAt, state.timeZone)
                    : "Not scheduled"}
                </p>

                {actionErrors[reminder.id] && (
                  <p role="alert" className="text-sm text-red-600">
                    {actionErrors[reminder.id]}
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className={BUTTON_CLASS}
                  aria-label={`Edit ${reminder.name}`}
                  onClick={() => setEditing({ reminder })}
                >
                  Edit
                </Button>

                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                    Recent sends
                  </summary>
                  {reminder.recent.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">Nothing sent yet.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                      {reminder.recent.map((send) => (
                        <li key={send.occurrence_at}>
                          {formatInstant(send.occurrence_at, state.timeZone)} ·{" "}
                          {summarizeRecent(send)}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <AutomationEditor
          key={editing.reminder?.id ?? "new"}
          appId={appId}
          appName={appName}
          reminder={editing.reminder}
          state={state}
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
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog
        open={enableTarget !== null}
        onOpenChange={(next) => {
          if (!next && !busyId) {
            setEnableTarget(null);
            setEnableError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Turn on this message?</DialogTitle>
            <DialogDescription>
              {enableTarget
                ? `Turn on ${enableTarget.name}? ${peopleLabel(
                    enableTarget.recipients.length
                  )} will get this ${describeSchedule(enableTarget).toLowerCase()}. Replies go to ${
                    gmail.email ?? "your Gmail"
                  }.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {enableError && (
            <p role="alert" className="text-sm text-red-600">
              {enableError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={BUTTON_CLASS}
              disabled={busyId !== null}
              onClick={() => {
                setEnableTarget(null);
                setEnableError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={BUTTON_CLASS}
              disabled={busyId !== null}
              onClick={() => {
                if (enableTarget) void applyEnabled(enableTarget, true);
              }}
            >
              {busyId ? "Turning on…" : "Turn on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
