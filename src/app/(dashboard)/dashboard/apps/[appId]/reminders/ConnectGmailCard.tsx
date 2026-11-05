"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Mirrors GoogleConnectionStatus from the server module without pulling server-only code into the browser. */
type ConnectionStatus = {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  canSend: boolean;
  canReadContacts: boolean;
  canReadOtherContacts: boolean;
  needsReconnect: boolean;
};

const BUTTON_CLASS = "h-11 px-4 sm:h-8";

/** The one card on the reminders page: connect, show what is connected, or disconnect. */
export function ConnectGmailCard({
  appId,
  status,
  configured,
}: {
  appId: string;
  status: ConnectionStatus;
  configured: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = status.email ?? "this account";

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/apps/${appId}/integrations/google`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Could not disconnect. Try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not disconnect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Send reminders from your Gmail</CardTitle>
          <CardDescription>Connecting Gmail isn&apos;t available yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!status.connected) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Send reminders from your Gmail</CardTitle>
          <CardDescription>
            Connect the Gmail account your customers already know. Reminders go out from it, and replies come back to
            it. We never see your password.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <a
            href={`/api/integrations/google/start?app=${appId}`}
            className={buttonVariants({ className: BUTTON_CLASS })}
          >
            Connect Gmail
          </a>
        </CardFooter>
      </Card>
    );
  }

  if (status.needsReconnect) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Reconnect Gmail</CardTitle>
          <CardDescription>Your Gmail connection ended. Connect again to keep reminders going.</CardDescription>
        </CardHeader>
        <CardFooter>
          <a
            href={`/api/integrations/google/start?app=${appId}`}
            className={buttonVariants({ className: BUTTON_CLASS })}
          >
            Connect Gmail
          </a>
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Connected as {email}</CardTitle>
        </CardHeader>
        {!status.canReadContacts && !status.canReadOtherContacts && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You didn&apos;t allow contacts, so you&apos;ll type email addresses by hand.
            </p>
          </CardContent>
        )}
        <CardFooter>
          <Button
            type="button"
            variant="outline"
            className={BUTTON_CLASS}
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            Disconnect
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {email}?</DialogTitle>
            <DialogDescription>Reminders stop until you connect again.</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={disconnect}>
              {busy ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
