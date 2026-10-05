"use client";

import { useState, useSyncExternalStore } from "react";
import { formatDayTimeRange } from "@/lib/format-date";

export interface RuntimeEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  bookedCount: number;
}

/** The page is drawn on the server first, which has no idea where the visitor is, so it uses US Pacific time (where
 * most apps are) and the browser then switches to the visitor's own time zone. Formatting once in each place with
 * different zones is what made React report a mismatch before. */
const SERVER_TIME_ZONE = "America/Los_Angeles";
const noopSubscribe = () => () => {};

export function formatRange(startsAt: string, endsAt: string | null, timeZone?: string): string {
  return formatDayTimeRange(new Date(startsAt), endsAt ? new Date(endsAt) : null, timeZone);
}

function EventTime({ startsAt, endsAt }: { startsAt: string; endsAt: string | null }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => formatRange(startsAt, endsAt),
    () => formatRange(startsAt, endsAt, SERVER_TIME_ZONE)
  );
  return <time dateTime={startsAt}>{text}</time>;
}

export function EventBookRuntime({ event }: { event: RuntimeEvent }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error" | "full">("idle");

  const full = event.capacity !== null && event.bookedCount >= event.capacity;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, customerName: name, customerEmail: email }),
      });
      if (res.status === 409) {
        setStatus("full");
        return;
      }
      setStatus(res.ok ? "submitted" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
        You&rsquo;re booked for {event.title}.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-4">
      <h3 className="font-medium">{event.title}</h3>
      <p className="text-sm text-muted-foreground">
        <EventTime startsAt={event.starts_at} endsAt={event.ends_at} />
      </p>
      {event.location && <p className="text-sm text-muted-foreground">{event.location}</p>}
      {event.description && <p className="text-sm">{event.description}</p>}

      {full || status === "full" ? (
        <p className="text-sm font-medium text-muted-foreground">Fully booked</p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Book
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2 pt-2">
          <input
            type="text"
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {status === "error" && <p className="text-sm text-destructive">Something went wrong — please try again.</p>}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {status === "submitting" ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      )}
    </div>
  );
}
