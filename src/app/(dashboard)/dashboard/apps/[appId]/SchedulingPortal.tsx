import Link from "next/link";
import { ArrowRight, Circle, CircleCheck, Plus } from "lucide-react";
import { BUSINESS_TOOLS } from "@/lib/apps/business-tools";
import { formatClock } from "@/lib/format-date";
import { isAppEditor } from "@/lib/org";
import { getConnectionStatus } from "@/lib/integrations/google/connection";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureSeriesVisits } from "@/lib/schedule/generate";
import { addDays, localDateOf } from "@/lib/schedule/recurrence";
import { countVisitsWithin, localDayBounds, localDaysBounds, visitsWithin } from "@/lib/schedule/day";
import {
  automationTileStatus,
  customersTileStatus,
  moreThisWeekLine,
  remindersTileStatus,
  scheduleTileStatus,
  setupSteps,
  visitLengthLabel,
} from "@/lib/schedule/portal";
import type { ScheduleVisitStatus } from "@/types/database";

const STATUS: Record<ScheduleVisitStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-sky-100 text-sky-800" },
  confirmed: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
  reschedule_requested: { label: "Wants to reschedule", className: "bg-amber-100 text-amber-900" },
  cancelled: { label: "Cancelled", className: "bg-neutral-200 text-neutral-600" },
  done: { label: "Done", className: "bg-neutral-200 text-neutral-700" },
};

const CARD = "rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-6";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950";

/**
 * The home of a visiting business (Scheduling on): what is on today, the one step to do next, and the four private
 * business sections. The public website still exists; its link lives quietly in the page header.
 */
export async function SchedulingPortal({ appId, timeZone }: { appId: string; timeZone: string }) {
  const supabase = await createClient();
  const now = new Date();

  try {
    // Top up the repeat rules before reading them, as the schedule screen does. A failure here must not hide the
    // visits that are already saved.
    await ensureSeriesVisits(supabase, appId, timeZone, now);
  } catch {
    // The portal still shows what is saved.
  }

  const today = localDateOf(now, timeZone);
  const todayBounds = localDayBounds(today, timeZone);
  const nextWeekBounds = localDaysBounds(addDays(today, 1), 7, timeZone);
  const weekBounds = localDaysBounds(today, 8, timeZone);

  const [{ data: visits }, { data: customers }, { count: visitCount }] = await Promise.all([
    supabase
      .from("schedule_visits")
      .select("*")
      .eq("app_id", appId)
      .gte("starts_at", todayBounds.start.toISOString())
      .lt("starts_at", nextWeekBounds.end.toISOString())
      .order("starts_at", { ascending: true }),
    supabase.from("schedule_customers").select("id, name").eq("app_id", appId).order("name", { ascending: true }),
    // One visit of any status or date is enough to know the business has started using the schedule.
    supabase.from("schedule_visits").select("id", { count: "exact", head: true }).eq("app_id", appId),
  ]);

  const todayVisits = visitsWithin(visits ?? [], todayBounds);
  const nextWeekCount = countVisitsWithin(visits ?? [], nextWeekBounds, ["scheduled", "confirmed"]);
  const weekCount = countVisitsWithin(visits ?? [], weekBounds, ["scheduled", "confirmed"]);
  const customerNames = new Map((customers ?? []).map((customer) => [customer.id, customer.name]));
  const customerCount = customers?.length ?? 0;
  const anyVisit = (visitCount ?? 0) > 0;
  const scheduleHref = `/dashboard/apps/${appId}/schedule`;

  // The Gmail connection and the Automation tables are private: read them only after the signed-in person is shown
  // to be an editor of this app.
  let editor = false;
  let gmailConnected = false;
  let gmailNeedsReconnect = false;
  let gmailReady = false;
  let remindersOn = false;
  let reminderHours: number | null = null;
  let automationCount = 0;
  if (await isAppEditor(supabase, appId)) {
    editor = true;
    const admin = createAdminClient();
    const [gmail, reminder, automations] = await Promise.all([
      getConnectionStatus(appId),
      admin.from("reminder_settings").select("enabled, hours_before").eq("app_id", appId).maybeSingle(),
      admin.from("automation_reminders").select("id", { count: "exact", head: true }).eq("app_id", appId).eq("enabled", true),
    ]);
    gmailConnected = gmail.connected;
    gmailNeedsReconnect = gmail.needsReconnect;
    gmailReady = gmail.connected && gmail.canSend && !gmail.needsReconnect;
    remindersOn = reminder.data?.enabled ?? false;
    reminderHours = reminder.data?.hours_before ?? null;
    automationCount = automations.count ?? 0;
  }

  const setup = setupSteps({ customers: customerCount, anyVisit, gmailReady });

  // A non-editor gets the plain hint from the shared business-tools list for the two private sections.
  function tileStatus(path: string, hint: string): string {
    switch (path) {
      case "schedule":
        return scheduleTileStatus(weekCount);
      case "customers":
        return customersTileStatus(customerCount);
      case "reminders":
        return editor
          ? remindersTileStatus({
              connected: gmailConnected,
              needsReconnect: gmailNeedsReconnect,
              enabled: remindersOn,
              hoursBefore: reminderHours,
            })
          : hint;
      case "automation":
        return editor ? automationTileStatus(automationCount) : hint;
      default:
        return hint;
    }
  }

  return (
    <>
      {/* Editors only: the Gmail step needs a fact a visitor cannot read. The strip disappears once all three are done. */}
      {editor && setup.doneCount < setup.steps.length && (
        <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold text-neutral-950">Get set up</h2>
            <p className="text-xs tabular-nums text-neutral-500">
              {setup.doneCount} of {setup.steps.length} done
            </p>
          </div>
          <ul className="mt-1 grid gap-0.5 sm:grid-cols-3 sm:gap-2">
            {setup.steps.map((step, index) => (
              <li key={step.key}>
                {step.done ? (
                  <span className="flex min-h-11 items-center gap-2 text-sm text-neutral-400">
                    <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-cyan-600" />
                    <span className="min-w-0">{step.label}</span>
                  </span>
                ) : (
                  <Link
                    href={`/dashboard/apps/${appId}/${step.path}`}
                    className={`flex min-h-11 items-center gap-2 rounded-lg text-sm transition hover:text-neutral-950 ${FOCUS} ${
                      index === setup.nextIndex ? "font-semibold text-neutral-950" : "font-normal text-neutral-700"
                    }`}
                  >
                    <Circle
                      aria-hidden
                      className={`h-4 w-4 shrink-0 ${index === setup.nextIndex ? "text-neutral-950" : "text-neutral-400"}`}
                    />
                    <span className="min-w-0">{step.label}</span>
                    {index === setup.nextIndex && <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={CARD}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-950">Today</h2>
          <Link
            href={scheduleHref}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 ${FOCUS}`}
          >
            <Plus aria-hidden className="h-4 w-4" /> Add a visit
          </Link>
        </div>

        {todayVisits.length > 0 ? (
          <ul className="mt-2 divide-y divide-neutral-100">
            {todayVisits.map((visit) => {
              const status = STATUS[visit.status];
              const customer = customerNames.get(visit.customer_id) ?? "Customer";
              const length = visitLengthLabel(visit.duration_minutes);
              return (
                <li
                  key={visit.id}
                  className={`flex items-start gap-3 py-3 ${visit.status === "cancelled" ? "opacity-60" : ""}`}
                >
                  <span className="w-[4.25rem] shrink-0 pt-0.5 text-sm font-medium tabular-nums text-neutral-950">
                    {formatClock(new Date(visit.starts_at), timeZone)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-neutral-950">{customer}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {visit.service ? `${visit.service} · ${length}` : length}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">Nothing scheduled today.</p>
        )}

        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 border-t border-neutral-100 pt-1 text-sm text-neutral-500">
          <span>{moreThisWeekLine(nextWeekCount)} ·</span>
          <Link
            href={scheduleHref}
            className={`inline-flex min-h-11 items-center font-medium text-neutral-700 underline-offset-4 transition hover:text-neutral-950 hover:underline ${FOCUS}`}
          >
            See the full schedule
          </Link>
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BUSINESS_TOOLS.map(({ path, label, hint, icon: Icon }) => (
          <Link
            key={path}
            href={`/dashboard/apps/${appId}/${path}`}
            className={`flex min-h-28 flex-col rounded-2xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-black/20 ${FOCUS}`}
          >
            <Icon aria-hidden className="h-5 w-5 text-cyan-600" />
            <span className="mt-2 block text-sm font-medium text-neutral-950">{label}</span>
            <span className="mt-auto block pt-1 text-xs text-neutral-500">{tileStatus(path, hint)}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
