"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  REMINDER_TOKENS,
  reminderValues,
  renderReminder,
  type ReminderToken,
} from "@/lib/reminders/render";
import type { ReminderHoursBefore, ReminderSettingsInput } from "@/lib/reminders/validate";

const BUTTON_CLASS = "h-11 px-4 sm:h-8";

const HOURS_ITEMS: Record<string, string> = {
  "1": "1 hour before",
  "2": "2 hours before",
  "4": "4 hours before",
  "12": "12 hours before",
  "24": "1 day before",
  "48": "2 days before",
  "72": "3 days before",
};

type SavedReminder = {
  hours_before: ReminderHoursBefore;
  subject: string;
  body: string;
  prep_note: string | null;
};

type FieldName = "subject" | "body" | "prep_note";

function sampleValues(business: string, timeZone: string, sampleStartsAt: string) {
  return reminderValues({
    name: "Alex Morgan",
    address: "123 Example Street",
    service: "Standard clean",
    business,
    startsAt: new Date(sampleStartsAt),
    timeZone,
  });
}

/**
 * The owner's reminder email editor: what to send, when, and a live preview.
 *
 * "Send me a test" only ever uses what is already saved (and the server only sends to the connected address), so
 * while there are unsaved edits it stays disabled.
 */
export function ReminderSettingsForm({
  appId,
  business,
  timeZone,
  email,
  sampleStartsAt,
  initialSettings,
}: {
  appId: string;
  business: string;
  timeZone: string;
  email: string;
  sampleStartsAt: string;
  initialSettings: ReminderSettingsInput;
}) {
  const [hours, setHours] = useState<ReminderHoursBefore>(initialSettings.hours_before);
  const [subject, setSubject] = useState(initialSettings.subject);
  const [body, setBody] = useState(initialSettings.body);
  const [prepNote, setPrepNote] = useState(initialSettings.prep_note ?? "");
  const [saved, setSaved] = useState<SavedReminder>(initialSettings);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const prepNoteRef = useRef<HTMLTextAreaElement>(null);
  const [lastField, setLastField] = useState<FieldName>("body");

  const trimmedPrepNote = prepNote.trim() || null;
  const dirty =
    hours !== saved.hours_before ||
    subject.trim() !== saved.subject ||
    body.trim() !== saved.body ||
    trimmedPrepNote !== saved.prep_note;

  const preview = renderReminder(
    { subject, body, prep_note: prepNote },
    sampleValues(business, timeZone, sampleStartsAt)
  );

  function restoreSelection(
    element: HTMLInputElement | HTMLTextAreaElement | null,
    position: number
  ) {
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(position, position);
    });
  }

  function insertToken(token: ReminderToken) {
    const snippet = `{${token}}`;

    if (lastField === "subject") {
      const element = subjectRef.current;
      const start = element?.selectionStart ?? subject.length;
      const end = element?.selectionEnd ?? subject.length;
      setSubject(subject.slice(0, start) + snippet + subject.slice(end));
      restoreSelection(element, start + snippet.length);
      return;
    }

    if (lastField === "prep_note") {
      const element = prepNoteRef.current;
      const start = element?.selectionStart ?? prepNote.length;
      const end = element?.selectionEnd ?? prepNote.length;
      setPrepNote(prepNote.slice(0, start) + snippet + prepNote.slice(end));
      restoreSelection(element, start + snippet.length);
      return;
    }

    const element = messageRef.current;
    const start = element?.selectionStart ?? body.length;
    const end = element?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + snippet + body.slice(end));
    restoreSelection(element, start + snippet.length);
  }

  async function handleSave() {
    setBusy("save");
    setSaveNotice(null);
    setSaveError(null);
    setTestNotice(null);
    setTestError(null);

    try {
      const response = await fetch(`/api/apps/${appId}/schedule/reminders`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours_before: hours,
          subject,
          body,
          prep_note: prepNote,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { settings?: SavedReminder; error?: string }
        | null;

      if (!response.ok || !payload?.settings) {
        setSaveError(payload?.error ?? "Could not save. Try again.");
        return;
      }

      const next = payload.settings;
      setHours(next.hours_before);
      setSubject(next.subject);
      setBody(next.body);
      setPrepNote(next.prep_note ?? "");
      setSaved(next);
      setSaveNotice("Saved.");
    } catch {
      setSaveError("Could not save. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleTest() {
    setBusy("test");
    setTestNotice(null);
    setTestError(null);

    try {
      const response = await fetch(`/api/apps/${appId}/schedule/reminders/test`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; to?: string; error?: string }
        | null;

      if (!response.ok) {
        setTestError(payload?.error ?? "Could not send the test. Try again.");
        return;
      }

      setTestNotice(`Sent to ${payload?.to ?? email}. Check your inbox.`);
    } catch {
      setTestError("Could not send the test. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Reminder email</CardTitle>
          <CardDescription>Choose when it goes out and write what your customer will read.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="reminder-when">Send the reminder</Label>
            <Select
              value={String(hours)}
              items={HOURS_ITEMS}
              onValueChange={(value) =>
                setHours(Number(String(value)) as ReminderHoursBefore)
              }
            >
              <SelectTrigger id="reminder-when" className="h-11 w-full text-base sm:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(HOURS_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reminder-subject">Subject</Label>
            <Input
              id="reminder-subject"
              ref={subjectRef}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              onFocus={() => setLastField("subject")}
              className="h-11 text-base md:text-base sm:h-8"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="reminder-body">Message</Label>
            <Textarea
              id="reminder-body"
              ref={messageRef}
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onFocus={() => setLastField("body")}
              className="text-base md:text-base"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">You can use:</p>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertToken(token)}
                  className="h-11 rounded-full bg-muted px-3 text-sm text-muted-foreground transition-colors hover:bg-muted-foreground/15 hover:text-foreground sm:h-8 sm:text-xs"
                >
                  {`{${token}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reminder-prep-note">Prep note (optional)</Label>
            <Textarea
              id="reminder-prep-note"
              ref={prepNoteRef}
              rows={3}
              value={prepNote}
              onChange={(event) => setPrepNote(event.target.value)}
              onFocus={() => setLastField("prep_note")}
              className="text-base md:text-base"
            />
            <p className="text-xs text-muted-foreground">
              Gate code, pets, parking. Shown at the end of the email as &apos;Before we arrive:&apos;.
            </p>
          </div>

          {saveError && (
            <p role="alert" className="text-sm text-red-600">
              {saveError}
            </p>
          )}
          {testError && (
            <p role="alert" className="text-sm text-red-600">
              {testError}
            </p>
          )}
          {saveNotice && <p className="text-sm text-muted-foreground">{saveNotice}</p>}
          {testNotice && <p className="text-sm text-muted-foreground">{testNotice}</p>}
          {dirty && (
            <p className="text-sm text-muted-foreground">Save first, then send a test.</p>
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button
            type="button"
            className={BUTTON_CLASS}
            disabled={busy !== null}
            onClick={handleSave}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={BUTTON_CLASS}
            disabled={busy !== null || dirty}
            onClick={handleTest}
          >
            {busy === "test" ? "Sending…" : "Send me a test"}
          </Button>
        </CardFooter>
      </Card>

      <p className="text-xs text-muted-foreground">
        Reminders aren&apos;t sent automatically yet. Until then, use Send me a test to see how it looks.
      </p>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>What your customer will see</CardTitle>
          <CardDescription>
            An example visit tomorrow at 10:00, in {timeZone}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-base font-semibold break-words">{preview.subject}</p>
          <div className="whitespace-pre-wrap text-base text-neutral-800">
            {preview.text}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
