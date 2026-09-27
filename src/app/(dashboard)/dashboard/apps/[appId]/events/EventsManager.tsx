"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import type { Database } from "@/types/database";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

/** `<input type="datetime-local">` has no timezone — its value is
 * interpreted as the browser's local time, which is what a creator
 * scheduling "their" event expects; Postgres stores whatever offset that
 * resolves to. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewEventForm({ appId, onCreated }: { appId: string; onCreated: (event: EventRow) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          location: location || undefined,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
          capacity: capacity ? Number(capacity) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to create event");
        return;
      }
      onCreated(body.event);
      setTitle("");
      setDescription("");
      setLocation("");
      setStartsAt("");
      setEndsAt("");
      setCapacity("");
      toast.success("Event added");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Add event</h2>
      <div className="space-y-1">
        <Label htmlFor="new-event-title">Title</Label>
        <Input id="new-event-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="new-event-starts">Starts</Label>
          <Input id="new-event-starts" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-event-ends">Ends (optional)</Label>
          <Input id="new-event-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="new-event-location">Location</Label>
          <Input id="new-event-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-event-capacity">Capacity (optional)</Label>
          <Input id="new-event-capacity" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-event-description">Description</Label>
        <Textarea id="new-event-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Adding…" : "Add event"}
      </Button>
    </form>
  );
}

function EventRowEditor({
  appId,
  event,
  onUpdated,
  onDeleted,
}: {
  appId: string;
  event: EventRow;
  onUpdated: (event: EventRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(event.starts_at));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, starts_at: new Date(startsAt).toISOString() }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to update event");
        return;
      }
      onUpdated(body.event);
      toast.success("Saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Failed to delete event");
        return;
      }
      onDeleted(event.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      </div>
      {event.location && <p className="text-xs text-muted-foreground">{event.location}</p>}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {event.capacity ? `Capacity: ${event.capacity}` : "No capacity limit"}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={handleSave}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={saving} onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EventsManager({ appId, initialEvents }: { appId: string; initialEvents: EventRow[] }) {
  const [events, setEvents] = useState(initialEvents);

  return (
    <div className="space-y-4">
      <NewEventForm appId={appId} onCreated={(event) => setEvents((prev) => [...prev, event])} />
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventRowEditor
              key={event.id}
              appId={appId}
              event={event}
              onUpdated={(updated) => setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
              onDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
