"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarPlus, Image as ImageIcon, Inbox, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocalTime } from "@/components/dashboard/LocalTime";
import { createClient } from "@/lib/supabase/client";
import { uploadAppAsset } from "@/lib/storage/upload";
import { formatDayTimeRange } from "@/lib/format-date";
import { PasteCard } from "./PasteCard";
import type { Database } from "@/types/database";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type SubmissionRow = Database["public"]["Tables"]["form_submissions"]["Row"];
type Photo = { src: string; alt?: string };

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

function Card({ icon: Icon, title, hint, children }: { icon: typeof CalendarPlus; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-neutral-950 text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
          <p className="text-sm text-neutral-500">{hint}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** The cards: paste anything, shows, photos, messages. Each talks to the app's existing APIs; nothing here is special-cased. */
export function QuickUpdates({
  appId,
  organizationId,
  initialEvents,
  initialPhotos,
  submissions,
}: {
  appId: string;
  organizationId: string;
  initialEvents: EventRow[];
  initialPhotos: Photo[];
  submissions: SubmissionRow[];
}) {
  return (
    <div className="space-y-5">
      <PasteCard appId={appId} organizationId={organizationId} />
      {/* Keyed on the events, so a paste that adds shows (and a page refresh) shows them in the list below. */}
      <ShowsCard key={initialEvents.map((e) => e.id).join(",")} appId={appId} initialEvents={initialEvents} />
      <PhotosCard appId={appId} organizationId={organizationId} initialPhotos={initialPhotos} />
      <MessagesCard appId={appId} submissions={submissions} />
    </div>
  );
}

function ShowsCard({ appId, initialEvents }: { appId: string; initialEvents: EventRow[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          starts_at: new Date(startsAt).toISOString(),
          location: location.trim() || undefined,
          ticket_url: ticketUrl.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't add the show");
        return;
      }
      setEvents((prev) => [...prev, body.event].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setTitle("");
      setStartsAt("");
      setLocation("");
      setTicketUrl("");
      setDescription("");
      toast.success("Show added. It's live.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(event: EventRow) {
    if (!confirm(`Remove "${event.title}" from the site?`)) return;
    const res = await fetch(`/api/apps/${appId}/events/${event.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't remove it");
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
  }

  return (
    <Card icon={CalendarPlus} title="Add a show" hint="Date, venue and where tickets are. It appears on the site the moment you add it.">
      <form onSubmit={add} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="qu-title">What&apos;s the show?</Label>
          <Input id="qu-title" required maxLength={200} placeholder="Friday night at Laughs Comedy Club" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="qu-when">When</Label>
            <Input id="qu-when" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qu-where">Where</Label>
            <Input id="qu-where" maxLength={300} placeholder="Venue and city" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="qu-tickets">Ticket link (optional)</Label>
          <Input id="qu-tickets" type="url" placeholder="https://www.eventbrite.com/e/…" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qu-desc">A line about it (optional)</Label>
          <Textarea id="qu-desc" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving} className="h-11 rounded-full px-5">
          {saving ? "Adding…" : "Add show"}
        </Button>
      </form>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-neutral-700">Coming up</h3>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No shows on the site yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {events.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-950">{event.title}</p>
                  <p className="text-sm text-neutral-500">
                    {formatDayTimeRange(new Date(event.starts_at), event.ends_at ? new Date(event.ends_at) : null)}
                    {event.location ? ` · ${event.location}` : ""}
                    {event.ticket_url ? " · Tickets linked" : ""}
                  </p>
                </div>
                <button type="button" onClick={() => void remove(event)} aria-label={`Remove ${event.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          Need to change a date or a detail? <Link href={`/dashboard/apps/${appId}/events`} className="underline">Edit shows</Link>.
        </p>
      </div>
    </Card>
  );
}

function PhotosCard({ appId, organizationId, initialPhotos }: { appId: string; organizationId: string; initialPhotos: Photo[] }) {
  const supabase = createClient();
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function filesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const tooBig = files.find((f) => f.size > MAX_PHOTO_BYTES);
    if (tooBig) {
      toast.error(`${tooBig.name} is over 15 MB. Try a smaller photo.`);
      return;
    }
    setBusy(`Uploading ${files.length === 1 ? "1 photo" : `${files.length} photos`}…`);
    try {
      const urls: string[] = [];
      for (const file of files) urls.push(await uploadAppAsset(supabase, organizationId, file));
      const res = await fetch(`/api/apps/${appId}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }) });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't add the photos");
        return;
      }
      setPhotos(body.images);
      toast.success(body.dropped > 0 ? `Added. The gallery holds ${body.max} photos, so ${body.dropped} didn't fit.` : "Photos added. They're live.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(photo: Photo) {
    const res = await fetch(`/api/apps/${appId}/photos`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: photo.src }) });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? "Couldn't remove it");
      return;
    }
    setPhotos(body.images);
  }

  return (
    <Card icon={ImageIcon} title="Add photos" hint="They go into the photo gallery on the site. Pick several at once.">
      <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={filesChosen} />
      <Button type="button" disabled={!!busy} onClick={() => fileInput.current?.click()} className="h-11 rounded-full px-5">
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {busy}
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" /> Choose photos
          </>
        )}
      </Button>
      {photos.length > 0 && (
        <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.src} className="group relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL */}
              <img src={photo.src} alt={photo.alt ?? ""} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => void remove(photo)}
                aria-label="Remove this photo"
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-neutral-500">{photos.length === 0 ? "No photos in the gallery yet." : `${photos.length} in the gallery. Hover a photo to remove it.`}</p>
    </Card>
  );
}

function MessagesCard({ appId, submissions }: { appId: string; submissions: SubmissionRow[] }) {
  return (
    <Card icon={Inbox} title="Messages" hint="What people sent through the forms on the site: bookings, questions, mailing-list sign-ups.">
      {submissions.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {submissions.map((s) => (
            <li key={s.id} className="py-3 text-sm">
              <p className="text-xs text-neutral-500">
                <LocalTime iso={s.created_at} />
              </p>
              <dl className="mt-1 space-y-0.5">
                {Object.entries(s.data).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="shrink-0 font-medium capitalize text-neutral-700">{key.replace(/_/g, " ")}:</dt>
                    <dd className="min-w-0 break-words text-neutral-600">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        <Link href={`/dashboard/apps/${appId}/submissions`} className="underline">All messages</Link>
      </p>
    </Card>
  );
}
