"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { renderAutomation } from "@/lib/automation/render";
import {
  describeSchedule,
  earliestOnceDate,
  looksLikeEmail,
  mergeRecipients,
  peopleLabel,
  previewValues,
  tomorrowDate,
  type AutomationContact,
  type AutomationRecipient,
  type AutomationReminder,
  type SchedulingState,
} from "@/lib/automation/ui";
import { ContactPicker } from "./ContactPicker";
import { automationBase, automationError } from "./automation-api";

const BUTTON_CLASS = "h-11 px-4 sm:h-8";
const INPUT_CLASS = "h-11 text-base sm:h-8";
const MAX_RECIPIENTS = 500;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_ITEMS: Record<string, string> = Object.fromEntries(
  WEEKDAYS.map((day, index) => [String(index), day])
);

/** The only placeholders a Scheduling message offers. */
const TOKENS = ["first_name", "name", "business"] as const;

interface FormState {
  name: string;
  scheduleKind: "weekly" | "once";
  weekday: number;
  onceDate: string;
  sendTime: string;
  subject: string;
  body: string;
  recipients: AutomationRecipient[];
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

function formFromReminder(reminder: AutomationReminder): FormState {
  return {
    name: reminder.name,
    scheduleKind: reminder.schedule_kind,
    weekday: reminder.weekday ?? 1,
    onceDate: reminder.once_date ?? "",
    sendTime: reminder.send_time.slice(0, 5),
    subject: reminder.subject,
    body: reminder.body,
    recipients: reminder.recipients.map((recipient) => ({
      name: recipient.name,
      email: recipient.email,
    })),
  };
}

function blankForm(defaults: SchedulingState["defaults"], onceDate: string): FormState {
  return {
    name: defaults.name,
    scheduleKind: defaults.schedule_kind,
    weekday: defaults.weekday ?? 1,
    onceDate: defaults.schedule_kind === "once" ? onceDate : "",
    sendTime: defaults.send_time.slice(0, 5),
    subject: defaults.subject,
    body: defaults.body,
    recipients: [],
  };
}

/** The form's meaningful values, in one string, so "has anything changed?" is one comparison. */
function snapshotOf(form: FormState): string {
  return JSON.stringify({
    name: form.name.trim(),
    scheduleKind: form.scheduleKind,
    weekday: form.scheduleKind === "weekly" ? form.weekday : null,
    onceDate: form.scheduleKind === "once" ? form.onceDate : null,
    sendTime: form.sendTime,
    subject: form.subject.trim(),
    body: form.body.trim(),
    recipients: form.recipients.map((recipient) => ({
      name: recipient.name === null ? null : recipient.name.trim() || null,
      email: emailKey(recipient.email),
    })),
  });
}

/**
 * One message's editor: what it says, when it goes out, who gets it, and a live preview. It opens over the
 * Automation screen and keeps itself open after a save so the owner can send a test of what they just saved.
 */
export function AutomationEditor({
  appId,
  appName,
  reminder,
  state,
  onSaved,
  onDeleted,
  onToggled,
  onClose,
}: {
  appId: string;
  appName: string;
  /** null = a new message, prefilled from the app's defaults. */
  reminder: AutomationReminder | null;
  state: SchedulingState;
  onSaved: (reminder: AutomationReminder) => void;
  onDeleted: (id: string) => void;
  onToggled: (id: string, enabled: boolean) => void;
  onClose: () => void;
}) {
  const base = automationBase(appId);
  const canUseGmailContacts =
    state.gmail.canReadContacts || state.gmail.canReadOtherContacts;

  const [now] = useState(() => new Date());
  const [initial] = useState<FormState>(() =>
    reminder
      ? formFromReminder(reminder)
      : blankForm(state.defaults, tomorrowDate(now, state.timeZone))
  );
  const [form, setForm] = useState<FormState>(initial);
  const [baseline, setBaseline] = useState<string>(() => snapshotOf(initial));
  const [savedId, setSavedId] = useState<string | null>(reminder?.id ?? null);
  const [enabled, setEnabled] = useState(reminder?.enabled ?? false);

  const [busy, setBusy] = useState<"save" | "test" | "toggle" | "delete" | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [askEnable, setAskEnable] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);

  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<AutomationContact[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  const dirty = snapshotOf(form) !== baseline;
  const atCap = form.recipients.length >= MAX_RECIPIENTS;
  const earliestDate = earliestOnceDate(now, state.timeZone);

  const scheduleText = describeSchedule({
    schedule_kind: form.scheduleKind,
    weekday: form.scheduleKind === "weekly" ? form.weekday : null,
    once_date: form.scheduleKind === "once" ? form.onceDate : null,
    send_time: form.sendTime,
  });

  let previewSubject = form.subject;
  let previewText = form.body;
  try {
    const rendered = renderAutomation(
      { subject: form.subject, body: form.body },
      previewValues(appName, now, state.timeZone)
    );
    previewSubject = rendered.subject;
    previewText = rendered.text;
  } catch {
    // An unreadable date or time zone leaves the preview as the words were typed.
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }) as FormState);
  }

  function restoreSelection(
    element: HTMLInputElement | HTMLTextAreaElement | null,
    position: number
  ) {
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(position, position);
    });
  }

  function insertToken(token: string) {
    const snippet = `{${token}}`;
    if (lastField.current === "subject") {
      const element = subjectRef.current;
      const start = element?.selectionStart ?? form.subject.length;
      const end = element?.selectionEnd ?? form.subject.length;
      setForm((previous) => ({
        ...previous,
        subject: previous.subject.slice(0, start) + snippet + previous.subject.slice(end),
      }));
      restoreSelection(element, start + snippet.length);
      return;
    }
    const element = bodyRef.current;
    const start = element?.selectionStart ?? form.body.length;
    const end = element?.selectionEnd ?? form.body.length;
    setForm((previous) => ({
      ...previous,
      body: previous.body.slice(0, start) + snippet + previous.body.slice(end),
    }));
    restoreSelection(element, start + snippet.length);
  }

  function addRecipients(additions: AutomationRecipient[]) {
    const existing = new Set(form.recipients.map((recipient) => emailKey(recipient.email)));
    const fresh = additions.filter(
      (addition) => !existing.has(emailKey(addition.email))
    );
    if (form.recipients.length + fresh.length > MAX_RECIPIENTS) {
      setManualError("You can add up to 500 people.");
      return;
    }
    setManualError(null);
    setForm((previous) => ({
      ...previous,
      recipients: mergeRecipients(previous.recipients, additions),
    }));
  }

  function addManual() {
    const email = manualEmail.trim();
    if (!looksLikeEmail(email)) {
      setManualError("Enter a valid email address.");
      return;
    }
    if (atCap) {
      setManualError("You can add up to 500 people.");
      return;
    }
    const merged = mergeRecipients(form.recipients, [
      { name: manualName.trim() || null, email },
    ]);
    if (merged.length === form.recipients.length) {
      setManualError("That address is already on the list.");
      return;
    }
    setForm((previous) => ({ ...previous, recipients: merged }));
    setManualEmail("");
    setManualName("");
    setManualError(null);
  }

  function removeRecipient(email: string) {
    const wanted = emailKey(email);
    setForm((previous) => ({
      ...previous,
      recipients: previous.recipients.filter(
        (recipient) => emailKey(recipient.email) !== wanted
      ),
    }));
  }

  async function openPicker() {
    setPickerOpen(true);
    if (!canUseGmailContacts || contactsLoaded || contactsLoading) return;

    setContactsLoading(true);
    setContactsError(null);
    try {
      const response = await fetch(`${base}/contacts`);
      const body = (await response.json().catch(() => null)) as {
        contacts?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok || !Array.isArray(body?.contacts)) {
        setContacts([]);
        setContactsError(
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Couldn't load your contacts. Try again."
        );
        return;
      }
      setContacts(body.contacts as AutomationContact[]);
      setContactsLoaded(true);
    } catch {
      setContacts([]);
      setContactsError("Couldn't load your contacts. Check your connection and try again.");
    } finally {
      setContactsLoading(false);
    }
  }

  async function save() {
    if (busy) return;
    setBusy("save");
    setSaveNotice(null);
    setSaveError(null);
    setTestNotice(null);
    setTestError(null);
    try {
      const response = await fetch(`${base}/reminders`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: savedId,
          name: form.name,
          schedule_kind: form.scheduleKind,
          weekday: form.scheduleKind === "weekly" ? form.weekday : null,
          once_date: form.scheduleKind === "once" ? form.onceDate : null,
          send_time: form.sendTime,
          subject: form.subject,
          body: form.body,
          recipients: form.recipients.map((recipient) => ({
            name: recipient.name,
            email: recipient.email,
          })),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        reminder?: AutomationReminder;
        error?: unknown;
      } | null;
      if (!response.ok || !body?.reminder) {
        setSaveError(
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not save the message. Try again."
        );
        return;
      }

      const saved = body.reminder;
      const next = formFromReminder(saved);
      setForm(next);
      setBaseline(snapshotOf(next));
      setSavedId(saved.id);
      setEnabled(saved.enabled);
      setSaveNotice("Saved.");
      onSaved(saved);
    } catch {
      setSaveError("Could not save. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (busy || !savedId || dirty) return;
    setBusy("test");
    setTestNotice(null);
    setTestError(null);
    try {
      const response = await fetch(`${base}/reminders/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: savedId }),
      });
      if (!response.ok) {
        setTestError(
          await automationError(response, "Could not send the test. Try again.")
        );
        return;
      }
      const body = (await response.json().catch(() => null)) as { to?: unknown } | null;
      const to = typeof body?.to === "string" ? body.to : state.gmail.email;
      setTestNotice(to ? `Sent to ${to}. Check your inbox.` : "Sent. Check your inbox.");
    } catch {
      setTestError("Could not send the test. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function applyEnabled(next: boolean) {
    if (!savedId || busy) return;
    setBusy("toggle");
    setToggleError(null);
    try {
      const response = await fetch(`${base}/reminders/enabled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: savedId, enabled: next }),
      });
      if (!response.ok) {
        setToggleError(
          await automationError(response, "Could not change the message. Try again.")
        );
        return;
      }
      setEnabled(next);
      onToggled(savedId, next);
    } catch {
      setToggleError("Could not change the message. Check your connection and try again.");
    } finally {
      setBusy(null);
      setAskEnable(false);
    }
  }

  function requestToggle(next: boolean) {
    if (!savedId || busy) return;
    if (!next) {
      void applyEnabled(false);
      return;
    }
    if (dirty) {
      setToggleError("Save your changes first.");
      return;
    }
    setToggleError(null);
    setAskEnable(true);
  }

  async function deleteReminder() {
    if (!savedId || busy) return;
    setBusy("delete");
    setDeleteError(null);
    try {
      const response = await fetch(
        `${base}/reminders?id=${encodeURIComponent(savedId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        setDeleteError(
          await automationError(response, "Could not delete the message. Try again.")
        );
        setAskDelete(false);
        return;
      }
      onDeleted(savedId);
    } catch {
      setDeleteError("Could not delete the message. Check your connection and try again.");
      setAskDelete(false);
    } finally {
      setBusy(null);
    }
  }

  function requestClose() {
    if (busy) return;
    if (dirty) {
      setAskDiscard(true);
      return;
    }
    onClose();
  }

  const dialogOpen = pickerOpen || askEnable || askDelete || askDiscard;
  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  });
  useEffect(() => {
    if (dialogOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-100">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {savedId ? "Edit message" : "New message"}
            </p>
            <h2 className="mt-1 break-words text-2xl font-semibold">
              {form.name.trim() || "Message"}
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Close"
            disabled={busy !== null}
            onClick={requestClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="mt-4 space-y-4">
          {savedId && (
            <Card>
              <CardHeader>
                <CardTitle>Sending</CardTitle>
                <CardDescription>
                  {enabled ? "On, and sending on schedule." : "Off, so nothing goes out."}
                </CardDescription>
                <CardAction>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{enabled ? "On" : "Off"}</span>
                    <Switch
                      checked={enabled}
                      disabled={busy !== null}
                      aria-label={`Sending: ${enabled ? "on" : "off"}`}
                      onCheckedChange={requestToggle}
                    />
                  </div>
                </CardAction>
              </CardHeader>
              {(dirty || toggleError) && (
                <CardContent className="space-y-2">
                  {dirty && (
                    <p className="text-sm text-muted-foreground">Save your changes first.</p>
                  )}
                  {toggleError && (
                    <p role="alert" className="text-sm text-red-600">
                      {toggleError}
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Name and time</CardTitle>
              <CardDescription>Give it a name, then choose the day and time it goes out.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="automation-name">Name</Label>
                <Input
                  id="automation-name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  maxLength={80}
                  className={INPUT_CLASS}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">When</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["weekly", "once"] as const).map((kind) => {
                    const selected = form.scheduleKind === kind;
                    return (
                      <label
                        key={kind}
                        className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 ${
                          selected ? "border-primary bg-accent" : "border-input"
                        }`}
                      >
                        <input
                          type="radio"
                          name="automation-schedule"
                          value={kind}
                          checked={selected}
                          onChange={() => update("scheduleKind", kind)}
                          className="sr-only"
                        />
                        {kind === "weekly" ? "Every week" : "One time"}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {form.scheduleKind === "weekly" ? (
                <div className="space-y-1">
                  <Label htmlFor="automation-weekday">Day</Label>
                  <Select
                    value={String(form.weekday)}
                    items={WEEKDAY_ITEMS}
                    onValueChange={(value) =>
                      update("weekday", Number(String(value)))
                    }
                  >
                    <SelectTrigger
                      id="automation-weekday"
                      className="h-11 w-full text-base sm:h-8"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day, index) => (
                        <SelectItem key={day} value={String(index)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="automation-date">Date</Label>
                  <Input
                    id="automation-date"
                    type="date"
                    min={earliestDate}
                    value={form.onceDate}
                    onChange={(event) => update("onceDate", event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="automation-time">Time</Label>
                <Input
                  id="automation-time"
                  type="time"
                  value={form.sendTime}
                  onChange={(event) => update("sendTime", event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Times are in {state.timeZone}.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Who gets it</CardTitle>
              <CardDescription>{peopleLabel(form.recipients.length)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one yet. Choose from your customers or type an address.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {form.recipients.map((recipient) => (
                    <li
                      key={emailKey(recipient.email)}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        {recipient.name && (
                          <span className="block truncate text-sm font-semibold">
                            {recipient.name}
                          </span>
                        )}
                        <span className="block truncate text-sm text-muted-foreground">
                          {recipient.email}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 sm:size-8"
                        aria-label={`Remove ${recipient.email}`}
                        onClick={() => removeRecipient(recipient.email)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                type="button"
                variant="outline"
                className={`${BUTTON_CLASS} w-full`}
                disabled={atCap}
                onClick={() => void openPicker()}
              >
                {contactsLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Choose people
              </Button>

              <div className="space-y-3 rounded-lg border p-3">
                <div className="space-y-1">
                  <Label htmlFor="automation-email">Add an email address</Label>
                  <Input
                    id="automation-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={manualEmail}
                    onChange={(event) => setManualEmail(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="automation-manual-name">
                    Name{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="automation-manual-name"
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    maxLength={120}
                    className={INPUT_CLASS}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={`${BUTTON_CLASS} w-full`}
                  disabled={atCap}
                  onClick={addManual}
                >
                  Add
                </Button>
                {manualError && (
                  <p role="alert" className="text-sm text-red-600">
                    {manualError}
                  </p>
                )}
                {atCap && (
                  <p className="text-sm text-muted-foreground">
                    You can add up to 500 people.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What it says</CardTitle>
              <CardDescription>
                Write the subject and message. The preview shows a made-up customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="automation-subject">Subject</Label>
                <Input
                  id="automation-subject"
                  ref={subjectRef}
                  value={form.subject}
                  onChange={(event) => update("subject", event.target.value)}
                  onFocus={() => {
                    lastField.current = "subject";
                  }}
                  maxLength={150}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="automation-body">Message</Label>
                <Textarea
                  id="automation-body"
                  ref={bodyRef}
                  rows={8}
                  value={form.body}
                  onChange={(event) => update("body", event.target.value)}
                  onFocus={() => {
                    lastField.current = "body";
                  }}
                  maxLength={3000}
                  className="min-h-40 text-base sm:text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="h-11 rounded-full bg-muted px-3 text-sm text-muted-foreground transition hover:text-foreground sm:h-8 sm:text-xs"
                  >
                    {`{${token}}`}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What they&apos;ll read
                </p>
                <p className="mt-2 break-words text-base font-semibold">{previewSubject}</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-base text-neutral-800">
                  {previewText}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className={BUTTON_CLASS}
                  disabled={busy !== null}
                  onClick={() => void save()}
                >
                  {busy === "save" && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {busy === "save" ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={BUTTON_CLASS}
                  disabled={busy !== null || dirty || !savedId}
                  onClick={() => void sendTest()}
                >
                  {busy === "test" && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {busy === "test" ? "Sending…" : "Send me a test"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={BUTTON_CLASS}
                  disabled={busy !== null}
                  onClick={requestClose}
                >
                  Cancel
                </Button>
                {savedId && (
                  <Button
                    type="button"
                    variant="destructive"
                    className={BUTTON_CLASS}
                    disabled={busy !== null}
                    onClick={() => {
                      setDeleteError(null);
                      setAskDelete(true);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>

              {(dirty || !savedId) && (
                <p className="text-sm text-muted-foreground">
                  Save first, then send a test.
                </p>
              )}
              {saveError && (
                <p role="alert" className="text-sm text-red-600">
                  {saveError}
                </p>
              )}
              {saveNotice && (
                <p role="status" className="text-sm text-muted-foreground">
                  {saveNotice}
                </p>
              )}
              {testError && (
                <p role="alert" className="text-sm text-red-600">
                  {testError}
                </p>
              )}
              {testNotice && (
                <p role="status" className="text-sm text-muted-foreground">
                  {testNotice}
                </p>
              )}
              {deleteError && (
                <p role="alert" className="text-sm text-red-600">
                  {deleteError}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {pickerOpen && (
          <ContactPicker
            customers={state.customers}
            contacts={contacts}
            contactsLoading={contactsLoading}
            contactsError={contactsError}
            canUseGmailContacts={canUseGmailContacts}
            chosen={form.recipients}
            onAdd={addRecipients}
            onClose={() => setPickerOpen(false)}
          />
        )}

        <Dialog open={askEnable} onOpenChange={(next) => !busy && setAskEnable(next)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Turn on this message?</DialogTitle>
              <DialogDescription>
                {`Turn on ${form.name.trim() || "this message"}? ${peopleLabel(
                  form.recipients.length
                )} will get this ${scheduleText.toLowerCase()}. Replies go to ${
                  state.gmail.email ?? "your Gmail"
                }.`}
              </DialogDescription>
            </DialogHeader>
            {toggleError && (
              <p role="alert" className="text-sm text-red-600">
                {toggleError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={BUTTON_CLASS}
                disabled={busy !== null}
                onClick={() => setAskEnable(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={BUTTON_CLASS}
                disabled={busy !== null}
                onClick={() => void applyEnabled(true)}
              >
                {busy === "toggle" ? "Turning on…" : "Turn on"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={askDelete} onOpenChange={(next) => !busy && setAskDelete(next)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Delete {form.name.trim() || "this message"}?
              </DialogTitle>
              <DialogDescription>It will stop sending.</DialogDescription>
            </DialogHeader>
            {deleteError && (
              <p role="alert" className="text-sm text-red-600">
                {deleteError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={BUTTON_CLASS}
                disabled={busy !== null}
                onClick={() => setAskDelete(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className={BUTTON_CLASS}
                disabled={busy !== null}
                onClick={() => void deleteReminder()}
              >
                {busy === "delete" ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={askDiscard}
          onOpenChange={(next) => !busy && setAskDiscard(next)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Discard your changes?</DialogTitle>
              <DialogDescription>Your edits haven&apos;t been saved.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={BUTTON_CLASS}
                onClick={() => setAskDiscard(false)}
              >
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                className={BUTTON_CLASS}
                onClick={onClose}
              >
                Discard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
