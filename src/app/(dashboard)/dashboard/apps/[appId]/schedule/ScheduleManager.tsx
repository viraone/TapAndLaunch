"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, CheckCheck, Clock, MoreHorizontal, Plus, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatClock } from "@/lib/format-date";
import { groupVisitsByDay, splitUpcoming } from "@/lib/schedule/group";
import { localDateOf } from "@/lib/schedule/recurrence";
import type { Database, ScheduleVisitStatus } from "@/types/database";

type VisitRow = Database["public"]["Tables"]["schedule_visits"]["Row"];
type CustomerOption = { id: string; name: string };

const STATUS: Record<ScheduleVisitStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-sky-100 text-sky-800" },
  confirmed: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
  reschedule_requested: { label: "Wants to reschedule", className: "bg-amber-100 text-amber-900" },
  cancelled: { label: "Cancelled", className: "bg-neutral-200 text-neutral-600" },
  done: { label: "Done", className: "bg-neutral-200 text-neutral-700" },
};

const BASE_DURATIONS = [60, 90, 120, 150, 180, 240, 300, 360];

const REPEAT_ITEMS: Record<string, string> = {
  "0": "Doesn't repeat",
  "1": "Every week",
  "2": "Every 2 weeks",
  "3": "Every 3 weeks",
  "4": "Every 4 weeks",
};

const DAY_HEADING = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function sortVisits(visits: VisitRow[]): VisitRow[] {
  return [...visits].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
}

function mergeVisits(existing: VisitRow[], added: VisitRow[]): VisitRow[] {
  const byId = new Map(existing.map((visit) => [visit.id, visit]));
  for (const visit of added) byId.set(visit.id, visit);
  return sortVisits(Array.from(byId.values()));
}

function durationLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

function durationChoices(current: number[]): number[] {
  const all = new Set(BASE_DURATIONS);
  for (const minutes of current) {
    if (Number.isInteger(minutes) && minutes >= 15 && minutes <= 720) all.add(minutes);
  }
  return Array.from(all).sort((a, b) => a - b);
}

/** "Tuesday, Nov 10", or "Today" for the local date passed in. */
function dayHeading(date: string, today: string): string {
  if (date === today) return "Today";
  return DAY_HEADING.format(new Date(`${date}T12:00:00.000Z`));
}

/** The local date and "HH:mm" of an instant in the app's time zone. */
function localTimeParts(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

async function readJson<T>(res: Response): Promise<T | null> {
  return (await res.json().catch(() => null)) as T | null;
}

interface AddFormState {
  customerId: string;
  date: string;
  time: string;
  duration: string;
  service: string;
  notes: string;
  repeatWeeks: string;
  repeatUntil: string;
}

function emptyAddForm(defaultDurationMinutes: number): AddFormState {
  return {
    customerId: "",
    date: "",
    time: "",
    duration: String(defaultDurationMinutes),
    service: "",
    notes: "",
    repeatWeeks: "0",
    repeatUntil: "",
  };
}

interface ChangeFormState {
  date: string;
  time: string;
  duration: string;
}

function VisitItem({
  visit,
  customerName,
  timeZone,
  activeSeries,
  onConfirm,
  onDone,
  onChangeTime,
  onCancel,
  onStopRepeating,
}: {
  visit: VisitRow;
  customerName: string;
  timeZone: string;
  activeSeries: boolean;
  onConfirm: () => void;
  onDone: () => void;
  onChangeTime: () => void;
  onCancel: () => void;
  onStopRepeating: () => void;
}) {
  const start = new Date(visit.starts_at);
  const end = new Date(start.getTime() + visit.duration_minutes * 60_000);
  const timeLabel = `${formatClock(start, timeZone)} – ${formatClock(end, timeZone)}`;
  const status = STATUS[visit.status];
  const finished = visit.status === "done" || visit.status === "cancelled";

  return (
    <li
      className={`rounded-xl bg-white p-3 ring-1 ring-black/5 sm:p-4 ${
        visit.status === "cancelled" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold break-words sm:text-base">
            {timeLabel} <span className="font-normal text-muted-foreground">·</span> {customerName}
          </p>
          {visit.service && (
            <p className="mt-0.5 text-sm break-words text-muted-foreground">{visit.service}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={status.className}>
              {status.label}
            </Badge>
            {visit.series_id && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Repeat className="h-3 w-3" /> Repeats
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${customerName}'s visit at ${formatClock(start, timeZone)}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted sm:size-8"
          >
            <MoreHorizontal className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              className="min-h-11 sm:min-h-0"
              disabled={finished || visit.status === "confirmed"}
              onClick={onConfirm}
            >
              <Check /> Mark confirmed
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 sm:min-h-0" disabled={finished} onClick={onDone}>
              <CheckCheck /> Mark done
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 sm:min-h-0" onClick={onChangeTime}>
              <Clock /> Change time
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11 sm:min-h-0"
              variant="destructive"
              disabled={visit.status === "cancelled"}
              onClick={onCancel}
            >
              <Ban /> Cancel visit
            </DropdownMenuItem>
            {activeSeries && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-11 sm:min-h-0"
                  variant="destructive"
                  onClick={onStopRepeating}
                >
                  <Repeat /> Stop repeating
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function ScheduleManager({
  appId,
  timeZone,
  defaultDurationMinutes,
  customers,
  initialVisits,
  initialActiveSeriesIds,
  nowIso,
}: {
  appId: string;
  timeZone: string;
  defaultDurationMinutes: number;
  customers: CustomerOption[];
  initialVisits: VisitRow[];
  initialActiveSeriesIds: string[];
  nowIso: string;
}) {
  const router = useRouter();
  const [visits, setVisits] = useState(initialVisits);
  const [activeSeriesIds, setActiveSeriesIds] = useState(initialActiveSeriesIds);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>(() =>
    emptyAddForm(defaultDurationMinutes)
  );
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [changeVisit, setChangeVisit] = useState<VisitRow | null>(null);
  const [changeForm, setChangeForm] = useState<ChangeFormState>({
    date: "",
    time: "",
    duration: String(defaultDurationMinutes),
  });
  const [changeSaving, setChangeSaving] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [stopVisit, setStopVisit] = useState<VisitRow | null>(null);
  const [stopBusy, setStopBusy] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const now = new Date(nowIso);
  const today = localDateOf(now, timeZone);
  const { upcoming, earlier } = splitUpcoming(visits, timeZone, now);
  const upcomingDays = groupVisitsByDay(upcoming, timeZone);
  const earlierDays = groupVisitsByDay(earlier, timeZone);

  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const customerItems: Record<string, string> = Object.fromEntries(
    customers.map((customer) => [customer.id, customer.name])
  );
  const durationItems: Record<string, string> = Object.fromEntries(
    durationChoices([
      defaultDurationMinutes,
      ...(changeVisit ? [changeVisit.duration_minutes] : []),
    ]).map((minutes) => [String(minutes), durationLabel(minutes)])
  );

  function replaceVisit(updated: VisitRow) {
    setVisits((prev) => prev.map((visit) => (visit.id === updated.id ? updated : visit)));
  }

  async function markVisit(visit: VisitRow, status: ScheduleVisitStatus) {
    try {
      const res = await fetch(`/api/apps/${appId}/schedule/visits/${visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await readJson<{ visit?: VisitRow; error?: string }>(res);
      if (!res.ok || !body?.visit) {
        toast.error(body?.error ?? "Could not update this visit.");
        return;
      }
      replaceVisit(body.visit);
      toast.success(status === "confirmed" ? "Visit confirmed" : "Visit marked done");
    } catch {
      toast.error("Could not update this visit. Check your connection.");
    }
  }

  async function cancelVisit(visit: VisitRow) {
    try {
      const res = await fetch(`/api/apps/${appId}/schedule/visits/${visit.id}`, {
        method: "DELETE",
      });
      const body = await readJson<{ visit?: VisitRow; error?: string }>(res);
      if (!res.ok) {
        toast.error(body?.error ?? "Could not cancel this visit.");
        return;
      }
      if (body?.visit) {
        replaceVisit(body.visit);
        toast.success("Visit cancelled");
      } else {
        setVisits((prev) => prev.filter((row) => row.id !== visit.id));
        toast.success("Visit removed");
      }
    } catch {
      toast.error("Could not cancel this visit. Check your connection.");
    }
  }

  function openAdd() {
    setAddForm(emptyAddForm(defaultDurationMinutes));
    setAddError(null);
    setAddOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.customerId) {
      setAddError("Choose a customer.");
      return;
    }
    if (!addForm.date || !addForm.time) {
      setAddError("Choose a date and a start time.");
      return;
    }

    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/schedule/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: addForm.customerId,
          date: addForm.date,
          time: addForm.time,
          duration_minutes: Number(addForm.duration),
          service: addForm.service || null,
          notes: addForm.notes || null,
          repeat_every_weeks:
            addForm.repeatWeeks === "0" ? null : Number(addForm.repeatWeeks),
          repeat_until:
            addForm.repeatWeeks !== "0" && addForm.repeatUntil
              ? addForm.repeatUntil
              : null,
        }),
      });
      const body = await readJson<{
        visits?: VisitRow[];
        series?: { id: string };
        error?: string;
      }>(res);
      if (!res.ok || !body?.visits) {
        setAddError(body?.error ?? "Could not add this visit. Try again.");
        return;
      }

      const added = body.visits;
      const seriesId = body.series?.id;
      setVisits((prev) => mergeVisits(prev, added));
      if (seriesId) {
        setActiveSeriesIds((prev) =>
          prev.includes(seriesId) ? prev : [...prev, seriesId]
        );
      }
      setAddOpen(false);
      toast.success(added.length > 1 ? "Visit added, and it repeats" : "Visit added");
    } catch {
      setAddError("Could not add this visit. Check your connection and try again.");
    } finally {
      setAddSaving(false);
    }
  }

  function openChange(visit: VisitRow) {
    const parts = localTimeParts(visit.starts_at, timeZone);
    setChangeVisit(visit);
    setChangeForm({
      date: parts.date,
      time: parts.time,
      duration: String(visit.duration_minutes),
    });
    setChangeError(null);
  }

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    if (!changeVisit) return;

    setChangeSaving(true);
    setChangeError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/schedule/visits/${changeVisit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: changeForm.date,
          time: changeForm.time,
          duration_minutes: Number(changeForm.duration),
        }),
      });
      const body = await readJson<{ visit?: VisitRow; error?: string }>(res);
      if (!res.ok || !body?.visit) {
        setChangeError(body?.error ?? "Could not change this visit. Try again.");
        return;
      }
      replaceVisit(body.visit);
      setChangeVisit(null);
      toast.success("Visit updated");
    } catch {
      setChangeError("Could not change this visit. Check your connection and try again.");
    } finally {
      setChangeSaving(false);
    }
  }

  async function handleStopRepeating() {
    const seriesId = stopVisit?.series_id;
    if (!seriesId) return;

    setStopBusy(true);
    setStopError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/schedule/series/${seriesId}`, {
        method: "DELETE",
      });
      const body = await readJson<{ error?: string }>(res);
      if (!res.ok) {
        setStopError(body?.error ?? "Could not stop this repeat. Try again.");
        return;
      }

      setActiveSeriesIds((prev) => prev.filter((id) => id !== seriesId));
      setVisits((prev) =>
        prev.filter(
          (visit) =>
            !(
              visit.series_id === seriesId &&
              new Date(visit.starts_at).getTime() > now.getTime() &&
              (visit.status === "scheduled" || visit.status === "confirmed")
            )
        )
      );
      setStopVisit(null);
      toast.success("Repeat stopped");
      router.refresh();
    } catch {
      setStopError("Could not stop this repeat. Check your connection and try again.");
    } finally {
      setStopBusy(false);
    }
  }

  function renderDays(days: { date: string; visits: VisitRow[] }[]) {
    return days.map((day) => (
      <section key={day.date}>
        <h3 className="mb-2 text-sm font-semibold">{dayHeading(day.date, today)}</h3>
        <ul className="space-y-2">
          {day.visits.map((visit) => (
            <VisitItem
              key={visit.id}
              visit={visit}
              customerName={customerNames.get(visit.customer_id) ?? "Customer"}
              timeZone={timeZone}
              activeSeries={
                visit.series_id !== null && activeSeriesIds.includes(visit.series_id)
              }
              onConfirm={() => void markVisit(visit, "confirmed")}
              onDone={() => void markVisit(visit, "done")}
              onChangeTime={() => openChange(visit)}
              onCancel={() => void cancelVisit(visit)}
              onStopRepeating={() => {
                setStopError(null);
                setStopVisit(visit);
              }}
            />
          ))}
        </ul>
      </section>
    ));
  }

  if (customers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add a customer first</CardTitle>
          <CardDescription>
            A visit needs someone to visit. Add a customer, then come back here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/dashboard/apps/${appId}/customers`}
            className="inline-flex h-11 items-center rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Go to Customers
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        <Button type="button" className="min-h-11 sm:min-h-0 px-4" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add visit
        </Button>
      </div>

      {upcomingDays.length === 0 ? (
        <p className="text-sm text-muted-foreground">No visits coming up.</p>
      ) : (
        <div className="space-y-5">{renderDays(upcomingDays)}</div>
      )}

      <details className="rounded-xl bg-white p-4 ring-1 ring-black/5">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
          Earlier (last 14 days)
        </summary>
        <div className="mt-3 space-y-5">
          {earlierDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits in the last 14 days.</p>
          ) : (
            renderDays(earlierDays)
          )}
        </div>
      </details>

      <Dialog open={addOpen} onOpenChange={(next) => !addSaving && setAddOpen(next)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add visit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-visit-customer">Customer</Label>
              <Select
                value={addForm.customerId || null}
                items={customerItems}
                onValueChange={(value) =>
                  setAddForm((prev) => ({ ...prev, customerId: String(value) }))
                }
              >
                <SelectTrigger id="add-visit-customer" className="h-11 w-full sm:h-8">
                  <SelectValue placeholder="Choose a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="add-visit-date">Date</Label>
                <Input
                  id="add-visit-date"
                  type="date"
                  required
                  value={addForm.date}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="h-11 sm:h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-visit-time">Start time</Label>
                <Input
                  id="add-visit-time"
                  type="time"
                  required
                  value={addForm.time}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, time: e.target.value }))}
                  className="h-11 sm:h-8"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-visit-length">Length</Label>
              <Select
                value={addForm.duration}
                items={durationItems}
                onValueChange={(value) =>
                  setAddForm((prev) => ({ ...prev, duration: String(value) }))
                }
              >
                <SelectTrigger id="add-visit-length" className="h-11 w-full sm:h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(durationItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-visit-service">Service</Label>
              <Input
                id="add-visit-service"
                placeholder="Standard clean"
                value={addForm.service}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, service: e.target.value }))
                }
                className="h-11 sm:h-8"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-visit-notes">Notes</Label>
              <Textarea
                id="add-visit-notes"
                rows={2}
                value={addForm.notes}
                onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-visit-repeat">Repeats</Label>
              <Select
                value={addForm.repeatWeeks}
                items={REPEAT_ITEMS}
                onValueChange={(value) =>
                  setAddForm((prev) => ({
                    ...prev,
                    repeatWeeks: String(value),
                    repeatUntil: String(value) === "0" ? "" : prev.repeatUntil,
                  }))
                }
              >
                <SelectTrigger id="add-visit-repeat" className="h-11 w-full sm:h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPEAT_ITEMS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {addForm.repeatWeeks !== "0" && (
              <div className="space-y-1">
                <Label htmlFor="add-visit-until">Until (optional)</Label>
                <Input
                  id="add-visit-until"
                  type="date"
                  min={addForm.date || undefined}
                  value={addForm.repeatUntil}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, repeatUntil: e.target.value }))
                  }
                  className="h-11 sm:h-8"
                />
                <p className="text-xs text-muted-foreground">Leave empty to keep repeating.</p>
              </div>
            )}

            {addError && (
              <p role="alert" className="text-sm text-red-600">
                {addError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                disabled={addSaving}
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 sm:h-9" disabled={addSaving}>
                {addSaving ? "Adding…" : "Add visit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={changeVisit !== null}
        onOpenChange={(next) => {
          if (!next && !changeSaving) setChangeVisit(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change time</DialogTitle>
            <DialogDescription>
              {changeVisit ? customerNames.get(changeVisit.customer_id) ?? "Customer" : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChange} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="change-visit-date">Date</Label>
                <Input
                  id="change-visit-date"
                  type="date"
                  required
                  value={changeForm.date}
                  onChange={(e) =>
                    setChangeForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="h-11 sm:h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="change-visit-time">Start time</Label>
                <Input
                  id="change-visit-time"
                  type="time"
                  required
                  value={changeForm.time}
                  onChange={(e) =>
                    setChangeForm((prev) => ({ ...prev, time: e.target.value }))
                  }
                  className="h-11 sm:h-8"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="change-visit-length">Length</Label>
              <Select
                value={changeForm.duration}
                items={durationItems}
                onValueChange={(value) =>
                  setChangeForm((prev) => ({ ...prev, duration: String(value) }))
                }
              >
                <SelectTrigger id="change-visit-length" className="h-11 w-full sm:h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(durationItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {changeError && (
              <p role="alert" className="text-sm text-red-600">
                {changeError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                disabled={changeSaving}
                onClick={() => setChangeVisit(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 sm:h-9" disabled={changeSaving}>
                {changeSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={stopVisit !== null}
        onOpenChange={(next) => {
          if (!next && !stopBusy) setStopVisit(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stop this repeat?</DialogTitle>
            <DialogDescription>
              Upcoming visits in it are removed. Past visits stay.
            </DialogDescription>
          </DialogHeader>

          {stopError && (
            <p role="alert" className="text-sm text-red-600">
              {stopError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              disabled={stopBusy}
              onClick={() => setStopVisit(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 sm:h-9"
              disabled={stopBusy}
              onClick={handleStopRepeating}
            >
              {stopBusy ? "Stopping…" : "Stop repeating"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
