"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, X } from "lucide-react";
import { automationValues, renderAutomation } from "@/lib/automation/render";
import { showDateAfter } from "@/lib/automation/schedule";
import { ROOT_AUTOMATION_TOKENS } from "@/lib/automation/validate";
import {
  describeSchedule,
  looksLikeEmail,
  mergeRecipients,
  peopleLabel,
  type AutomationContact,
  type AutomationDefaults,
  type AutomationRecipient,
  type AutomationReminder,
  type AutomationState,
} from "@/lib/automation/ui";
import { AUTOMATION_BASE, automationError, automationFetch } from "./automation-api";
import { AutomationConfirmDialog } from "./AutomationDialog";
import { ContactPicker } from "./ContactPicker";

const INPUT =
  "h-11 w-full rounded-xl border bg-muted px-3 text-base outline-none placeholder:text-muted-foreground focus:border-primary/60";
const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition active:scale-[0.99] disabled:opacity-40";
const SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-muted px-4 text-base font-semibold transition active:scale-[0.99] disabled:opacity-40";
const DANGER =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 text-base font-semibold text-red-400 transition active:scale-[0.99] disabled:opacity-40";

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

function formFromReminder(reminder: AutomationReminder): FormState {
  return {
    name: reminder.name,
    scheduleKind: reminder.schedule_kind,
    weekday: reminder.weekday ?? 4,
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

function blankForm(defaults: AutomationDefaults): FormState {
  return {
    name: defaults.name,
    scheduleKind: "weekly",
    weekday: defaults.weekday,
    onceDate: "",
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
      email: recipient.email.trim().toLowerCase(),
    })),
  });
}

/** The browser's own today, for the date box's `min`. */
function todayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

/**
 * One reminder's editor: what it says, when it goes out, who gets it, and a live preview. It opens over the
 * Automation screen, saves through PUT /openmic/automation/reminders, and keeps itself open afterwards so the owner
 * can send a test of what they just saved. Closing with unsaved edits asks first.
 */
export function AutomationEditor({
  client,
  reminder,
  state,
  showWeekday,
  onSaved,
  onDeleted,
  onToggled,
  onSignedOut,
  onClose,
}: {
  client: SupabaseClient;
  /** null = a new reminder, prefilled from the show's defaults. */
  reminder: AutomationReminder | null;
  state: AutomationState;
  showWeekday: number;
  onSaved: (reminder: AutomationReminder) => void;
  onDeleted: (id: string) => void;
  onToggled: (id: string, enabled: boolean) => void;
  onSignedOut: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    reminder ? formFromReminder(reminder) : blankForm(state.defaults)
  );
  const [baseline, setBaseline] = useState<string>(() =>
    snapshotOf(reminder ? formFromReminder(reminder) : blankForm(state.defaults))
  );
  const [savedId, setSavedId] = useState<string | null>(reminder?.id ?? null);
  const [enabled, setEnabled] = useState(reminder?.enabled ?? false);
  const [savedNextSendAt, setSavedNextSendAt] = useState<string | null>(
    reminder?.nextSendAt ?? null
  );

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
  const [pickerOpen, setPickerOpen] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  const dirty = snapshotOf(form) !== baseline;
  const atCap = form.recipients.length >= MAX_RECIPIENTS;
  const scheduleText = describeSchedule({
    schedule_kind: form.scheduleKind,
    weekday: form.scheduleKind === "weekly" ? form.weekday : null,
    once_date: form.scheduleKind === "once" ? form.onceDate : null,
    send_time: form.sendTime,
  });

  let previewSubject = form.subject;
  let previewText = form.body;
  try {
    const occurrence = savedNextSendAt ? new Date(savedNextSendAt) : new Date();
    const showDate = showDateAfter(occurrence, showWeekday, state.timeZone);
    const rendered = renderAutomation(
      { subject: form.subject, body: form.body },
      automationValues({
        name: "Alex Morgan",
        showName: state.showName,
        showDate,
        showTime: null,
        venue: null,
      })
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
    const existing = new Set(
      form.recipients.map((recipient) => recipient.email.trim().toLowerCase())
    );
    const fresh = additions.filter(
      (addition) => !existing.has(addition.email.trim().toLowerCase())
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
    const wanted = email.trim().toLowerCase();
    setForm((previous) => ({
      ...previous,
      recipients: previous.recipients.filter(
        (recipient) => recipient.email.trim().toLowerCase() !== wanted
      ),
    }));
  }

  async function openPicker() {
    if (contactsLoading) return;
    if (contacts) {
      setPickerOpen(true);
      return;
    }
    setContactsLoading(true);
    setContactsError(null);
    try {
      const result = await automationFetch(client, `${AUTOMATION_BASE}/contacts`);
      if (!result.ok || result.response.status === 401) {
        onSignedOut();
        return;
      }
      const body = (await result.response.json().catch(() => null)) as {
        contacts?: unknown;
        error?: unknown;
      } | null;
      if (!result.response.ok || !Array.isArray(body?.contacts)) {
        setContactsError(
          typeof body?.error === "string"
            ? body.error
            : "Couldn't load your contacts. Try again."
        );
        return;
      }
      setContacts(body.contacts as AutomationContact[]);
      setPickerOpen(true);
    } catch {
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
      const result = await automationFetch(client, `${AUTOMATION_BASE}/reminders`, {
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
      if (!result.ok || result.response.status === 401) {
        onSignedOut();
        return;
      }
      const body = (await result.response.json().catch(() => null)) as {
        reminder?: AutomationReminder;
        error?: unknown;
      } | null;
      if (!result.response.ok || !body?.reminder) {
        setSaveError(
          typeof body?.error === "string"
            ? body.error
            : "Could not save the reminder. Try again."
        );
        return;
      }

      const saved = body.reminder;
      const next = formFromReminder(saved);
      setForm(next);
      setBaseline(snapshotOf(next));
      setSavedId(saved.id);
      setEnabled(saved.enabled);
      setSavedNextSendAt(saved.nextSendAt);
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
      const result = await automationFetch(client, `${AUTOMATION_BASE}/reminders/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: savedId }),
      });
      if (!result.ok || result.response.status === 401) {
        onSignedOut();
        return;
      }
      if (!result.response.ok) {
        setTestError(
          await automationError(result.response, "Could not send the test. Try again.")
        );
        return;
      }
      const body = (await result.response.json().catch(() => null)) as {
        to?: unknown;
      } | null;
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
      const result = await automationFetch(
        client,
        `${AUTOMATION_BASE}/reminders/enabled`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: savedId, enabled: next }),
        }
      );
      if (!result.ok || result.response.status === 401) {
        onSignedOut();
        return;
      }
      if (!result.response.ok) {
        setToggleError(
          await automationError(result.response, "Could not change the reminder. Try again.")
        );
        return;
      }
      setEnabled(next);
      onToggled(savedId, next);
    } catch {
      setToggleError("Could not change the reminder. Check your connection and try again.");
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
      const result = await automationFetch(
        client,
        `${AUTOMATION_BASE}/reminders?id=${encodeURIComponent(savedId)}`,
        { method: "DELETE" }
      );
      if (!result.ok || result.response.status === 401) {
        onSignedOut();
        return;
      }
      if (!result.response.ok) {
        setDeleteError(
          await automationError(result.response, "Could not delete the reminder. Try again.")
        );
        setAskDelete(false);
        return;
      }
      onDeleted(savedId);
    } catch {
      setDeleteError("Could not delete the reminder. Check your connection and try again.");
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">
              {savedId ? "Edit reminder" : "New reminder"}
            </p>
            <h2 className="mt-1 break-words text-2xl font-black tracking-tight">
              {form.name.trim() || "Reminder"}
            </h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy !== null}
            aria-label="Close the reminder"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-muted disabled:opacity-40"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {savedId && (
          <div className="mt-4 rounded-2xl border bg-muted/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold">Sending</p>
                <p className="text-sm text-muted-foreground">
                  {enabled ? "On, and sending on schedule." : "Off, so nothing goes out."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold">{enabled ? "On" : "Off"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Sending: ${enabled ? "on" : "off"}`}
                  disabled={busy !== null}
                  onClick={() => requestToggle(!enabled)}
                  className="relative flex h-11 w-14 shrink-0 items-center disabled:opacity-40"
                >
                  <span
                    aria-hidden="true"
                    className={`h-7 w-12 rounded-full transition ${
                      enabled ? "bg-primary" : "bg-foreground/20"
                    }`}
                  />
                  <span
                    aria-hidden="true"
                    className={`absolute left-0.5 h-6 w-6 rounded-full bg-background shadow transition ${
                      enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
            {dirty && !enabled && (
              <p className="mt-2 text-sm text-muted-foreground">Save your changes first.</p>
            )}
            {toggleError && (
              <p role="alert" className="mt-2 text-sm text-red-400">
                {toggleError}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 rounded-2xl border bg-muted/60 p-4">
          <label htmlFor="automation-name" className="block text-sm font-semibold">
            Name
          </label>
          <input
            id="automation-name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            maxLength={80}
            className={`${INPUT} mt-1`}
          />
        </div>

        <div className="mt-3 rounded-2xl border bg-muted/60 p-4">
          <p className="text-sm font-semibold">When</p>
          <fieldset className="mt-1">
            <legend className="sr-only">How often</legend>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-base font-semibold ${
                  form.scheduleKind === "weekly" ? "border-primary/60 bg-primary/15" : "bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="automation-schedule"
                  value="weekly"
                  checked={form.scheduleKind === "weekly"}
                  onChange={() => update("scheduleKind", "weekly")}
                  className="sr-only"
                />
                Every week
              </label>
              <label
                className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-base font-semibold ${
                  form.scheduleKind === "once" ? "border-primary/60 bg-primary/15" : "bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="automation-schedule"
                  value="once"
                  checked={form.scheduleKind === "once"}
                  onChange={() => update("scheduleKind", "once")}
                  className="sr-only"
                />
                One time
              </label>
            </div>
          </fieldset>

          {form.scheduleKind === "weekly" ? (
            <>
              <label htmlFor="automation-weekday" className="mt-3 block text-sm font-semibold">
                Day
              </label>
              <select
                id="automation-weekday"
                value={form.weekday}
                onChange={(event) => update("weekday", Number(event.target.value))}
                className={`${INPUT} mt-1`}
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label htmlFor="automation-date" className="mt-3 block text-sm font-semibold">
                Date
              </label>
              <input
                id="automation-date"
                type="date"
                min={todayYmd()}
                value={form.onceDate}
                onChange={(event) => update("onceDate", event.target.value)}
                className={`${INPUT} mt-1`}
              />
            </>
          )}

          <label htmlFor="automation-time" className="mt-3 block text-sm font-semibold">
            Time
          </label>
          <input
            id="automation-time"
            type="time"
            value={form.sendTime}
            onChange={(event) => update("sendTime", event.target.value)}
            className={`${INPUT} mt-1`}
          />
          <p className="mt-2 text-sm text-muted-foreground">Times are in {state.timeZone}.</p>
        </div>

        <div className="mt-3 rounded-2xl border bg-muted/60 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">Who gets it</p>
            <p className="shrink-0 text-sm text-muted-foreground">
              {peopleLabel(form.recipients.length)}
            </p>
          </div>

          {form.recipients.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No one yet. Choose from your contacts or type an address.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-foreground/10 rounded-xl bg-muted">
              {form.recipients.map((recipient) => (
                <li
                  key={recipient.email.trim().toLowerCase()}
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
                  <button
                    type="button"
                    onClick={() => removeRecipient(recipient.email)}
                    aria-label={`Remove ${recipient.email}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(state.gmail.canReadContacts || state.gmail.canReadOtherContacts) && (
            <button
              type="button"
              onClick={() => void openPicker()}
              disabled={contactsLoading || atCap}
              className={`${SECONDARY} mt-3 w-full`}
            >
              {contactsLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {contactsLoading ? "Loading contacts…" : "Choose from my Gmail contacts"}
            </button>
          )}
          {contactsError && (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {contactsError}
            </p>
          )}

          <div className="mt-3 rounded-xl bg-muted p-3">
            <label htmlFor="automation-email" className="block text-sm font-semibold">
              Add an email address
            </label>
            <input
              id="automation-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={manualEmail}
              onChange={(event) => setManualEmail(event.target.value)}
              className={`${INPUT} mt-1`}
            />
            <label htmlFor="automation-manual-name" className="mt-2 block text-sm font-semibold">
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="automation-manual-name"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              maxLength={120}
              className={`${INPUT} mt-1`}
            />
            <button
              type="button"
              onClick={addManual}
              disabled={atCap}
              className={`${SECONDARY} mt-2 w-full`}
            >
              Add
            </button>
            {manualError && (
              <p role="alert" className="mt-2 text-sm text-red-400">
                {manualError}
              </p>
            )}
            {atCap && (
              <p className="mt-2 text-sm text-muted-foreground">
                You can add up to 500 people.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border bg-muted/60 p-4">
          <label htmlFor="automation-subject" className="block text-sm font-semibold">
            Subject
          </label>
          <input
            id="automation-subject"
            ref={subjectRef}
            value={form.subject}
            onChange={(event) => update("subject", event.target.value)}
            onFocus={() => {
              lastField.current = "subject";
            }}
            maxLength={150}
            className={`${INPUT} mt-1`}
          />

          <label htmlFor="automation-body" className="mt-3 block text-sm font-semibold">
            Message
          </label>
          <textarea
            id="automation-body"
            ref={bodyRef}
            rows={8}
            value={form.body}
            onChange={(event) => update("body", event.target.value)}
            onFocus={() => {
              lastField.current = "body";
            }}
            maxLength={3000}
            className="mt-1 w-full rounded-xl border bg-muted px-3 py-3 text-base leading-relaxed outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {ROOT_AUTOMATION_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => insertToken(token)}
                className="h-11 rounded-full bg-muted px-3 text-sm text-muted-foreground transition hover:text-foreground"
              >
                {`{${token}}`}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border bg-background/40 p-4">
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">
              What they&apos;ll read
            </p>
            <p className="mt-2 break-words text-base font-semibold">{previewSubject}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-base text-muted-foreground">
              {previewText}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border bg-muted/60 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy !== null}
              className={PRIMARY}
            >
              {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={busy !== null || dirty || !savedId}
              className={SECONDARY}
            >
              {busy === "test" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy === "test" ? "Sending…" : "Send me a test"}
            </button>
            {savedId && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setAskDelete(true);
                }}
                disabled={busy !== null}
                className={DANGER}
              >
                Delete reminder
              </button>
            )}
          </div>

          {(dirty || !savedId) && (
            <p className="mt-2 text-sm text-muted-foreground">Save first, then send a test.</p>
          )}
          {saveError && (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {saveError}
            </p>
          )}
          {saveNotice && (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {saveNotice}
            </p>
          )}
          {testError && (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {testError}
            </p>
          )}
          {testNotice && (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {testNotice}
            </p>
          )}
          {deleteError && (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {deleteError}
            </p>
          )}
        </div>

        {pickerOpen && contacts && (
          <ContactPicker
            contacts={contacts}
            chosen={form.recipients}
            onAdd={addRecipients}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {askEnable && (
          <AutomationConfirmDialog
            title="Turn on this reminder?"
            message={`Turn on ${form.name.trim() || "this reminder"}? ${peopleLabel(
              form.recipients.length
            )} will get this ${scheduleText.toLowerCase()}. Replies go to ${
              state.gmail.email ?? "your Gmail"
            }.`}
            confirmLabel="Turn on"
            busy={busy === "toggle"}
            onConfirm={() => void applyEnabled(true)}
            onClose={() => setAskEnable(false)}
          />
        )}

        {askDelete && (
          <AutomationConfirmDialog
            title="Delete this reminder?"
            message={`Delete ${form.name.trim() || "this reminder"}? It will stop sending.`}
            confirmLabel="Delete"
            tone="danger"
            busy={busy === "delete"}
            onConfirm={() => void deleteReminder()}
            onClose={() => setAskDelete(false)}
          />
        )}

        {askDiscard && (
          <AutomationConfirmDialog
            title="Discard your changes?"
            message="Your edits haven't been saved."
            confirmLabel="Discard"
            tone="danger"
            onConfirm={onClose}
            onClose={() => setAskDiscard(false)}
          />
        )}
      </div>
    </div>
  );
}
