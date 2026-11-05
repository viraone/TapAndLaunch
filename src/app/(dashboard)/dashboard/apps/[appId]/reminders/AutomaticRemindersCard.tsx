"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

/** "24" reads as "1 day" on the card; the form below uses the same wording. */
function beforeLabel(hours: number): string {
  if (hours === 24) return "1 day";
  if (hours === 48) return "2 days";
  if (hours === 72) return "3 days";
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

const BUTTON_CLASS = "h-11 px-4 sm:h-8";

/**
 * The on/off switch for automatic reminders. Turning on asks first; turning off takes effect at once, and still
 * works when the Gmail connection has since been removed.
 */
export function AutomaticRemindersCard({
  appId,
  enabled,
  hoursBefore,
  hasSavedReminder,
}: {
  appId: string;
  enabled: boolean;
  hoursBefore: number;
  hasSavedReminder: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/apps/${appId}/schedule/reminders/enabled`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { enabled?: boolean; error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Could not change automatic reminders. Try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not change automatic reminders. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const status = enabled
    ? `On — customers get this reminder ${beforeLabel(hoursBefore)} before each visit.`
    : "Off — nothing is sent.";

  return (
    <>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Automatic reminders</CardTitle>
          <CardDescription>{status}</CardDescription>
          <CardAction>
            <Switch
              checked={enabled}
              disabled={busy || !hasSavedReminder}
              onCheckedChange={(checked) => {
                if (!checked) {
                  void change(false);
                  return;
                }
                setError(null);
                setOpen(true);
              }}
              aria-label="Automatic reminders"
            />
          </CardAction>
        </CardHeader>
        {(!hasSavedReminder || (error && !open)) && (
          <CardContent className="space-y-2">
            {!hasSavedReminder && (
              <p className="text-sm text-muted-foreground">Save your reminder below first.</p>
            )}
            {error && !open && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn on automatic reminders?</DialogTitle>
            <DialogDescription>
              Each customer with an email address will get this reminder before their visit. Customers
              without an email are skipped.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className={BUTTON_CLASS}
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={BUTTON_CLASS}
              disabled={busy}
              onClick={() => change(true)}
            >
              {busy ? "Turning on…" : "Turn on"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
