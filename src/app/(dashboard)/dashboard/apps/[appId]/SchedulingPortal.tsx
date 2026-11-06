import Link from "next/link";
import { ArrowRight, Circle, CircleCheck, Plus } from "lucide-react";
import { formatClock } from "@/lib/format-date";
import { isAppEditor } from "@/lib/org";
import { getConnectionStatus } from "@/lib/integrations/google/connection";
import { createClient } from "@/lib/supabase/server";
import { ensureSeriesVisits } from "@/lib/schedule/generate";
import { addDays, localDateOf } from "@/lib/schedule/recurrence";
import { countVisitsWithin, localDayBounds, localDaysBounds, visitsWithin } from "@/lib/schedule/day";
import { moreThisWeekLine, setupSteps, visitLengthLabel } from "@/lib/schedule/portal";
import type { ScheduleVisitStatus } from "@/types/database";

const STATUS: Record<ScheduleVisitStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-sky-100 text-sky-800" },
  confirmed: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
  reschedule_requested: { label: "Wants to reschedule", className: "bg-amber-100 text-amber-900" },
  cancelled: { label: "Cancelled", className: "bg-neutral-200 text-neutral-600" },
  done: { label: "Done", className: "bg-neutral-200 text-neutral-700" },
};

const CARD = "rounded-2xl bg-neutral-100 p-5 sm:p-6";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950";

/**
 * The home of a visiting business (Scheduling on): what is on today and the one step to do next. The four private
 * business sections live in the sidebar. The public website still exists; its link lives quietly in the page header.
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
  const customerNames = new Map((customers ?? []).map((customer) => [customer.id, customer.name]));
  const customerCount = customers?.length ?? 0;
  const anyVisit = (visitCount ?? 0) > 0;
  const scheduleHref = `/dashboard/apps/${appId}/schedule`;

  // The Gmail connection is private: read it only after the signed-in person is shown to be an editor of this app.
  let editor = false;
  let gmailReady = false;
  if (await isAppEditor(supabase, appId)) {
    editor = true;
    const gmail = await getConnectionStatus(appId);
    gmailReady = gmail.connected && gmail.canSend && !gmail.needsReconnect;
  }

  const setup = setupSteps({ customers: customerCount, anyVisit, gmailReady });

  return (
    <>
      {/* Editors only: the Gmail step needs a fact a visitor cannot read. The strip disappears once all three are done. */}
      {editor && setup.doneCount < setup.steps.length && (
        <section className="rounded-2xl bg-neutral-100 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-sm font-medium text-neutral-950">Get set up</h2>
            <p className="text-xs tabular-nums text-neutral-500">
              {setup.doneCount} of {setup.steps.length} done
            </p>
          </div>
          <ul className="mt-1 grid gap-0.5 sm:grid-cols-3 sm:gap-2">
            {setup.steps.map((step, index) => (
              <li key={step.key}>
                {step.done ? (
                  <span className="flex min-h-11 items-center gap-2 text-sm text-neutral-400">
                    <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-neutral-500" />
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
          <h2 className="text-lg font-medium text-neutral-950">Today</h2>
          <Link
            href={scheduleHref}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 ${FOCUS}`}
          >
            <Plus aria-hidden className="h-4 w-4" /> Add a visit
          </Link>
        </div>

        {todayVisits.length > 0 ? (
          <ul className="mt-2 divide-y divide-neutral-200">
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

        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 border-t border-neutral-200 pt-1 text-sm text-neutral-500">
          <span>{moreThisWeekLine(nextWeekCount)} ·</span>
          <Link
            href={scheduleHref}
            className={`inline-flex min-h-11 items-center font-medium text-neutral-700 underline-offset-4 transition hover:text-neutral-950 hover:underline ${FOCUS}`}
          >
            See the full schedule
          </Link>
        </p>
      </section>
    </>
  );
}
