import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BUSINESS_TOOLS } from "@/lib/apps/business-tools";
import { formatClock } from "@/lib/format-date";
import { isAppEditor } from "@/lib/org";
import { getConnectionStatus } from "@/lib/integrations/google/connection";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureSeriesVisits } from "@/lib/schedule/generate";
import { addDays, localDateOf } from "@/lib/schedule/recurrence";
import { countVisitsWithin, localDayBounds, localDaysBounds, visitsWithin } from "@/lib/schedule/day";
import type { ScheduleVisitStatus } from "@/types/database";

const STATUS: Record<ScheduleVisitStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-sky-100 text-sky-800" },
  confirmed: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
  reschedule_requested: { label: "Wants to reschedule", className: "bg-amber-100 text-amber-900" },
  cancelled: { label: "Cancelled", className: "bg-neutral-200 text-neutral-600" },
  done: { label: "Done", className: "bg-neutral-200 text-neutral-700" },
};

const CARD = "rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5";

/**
 * The home of a visiting business (Scheduling on): today's visits and the way into the four private business
 * sections, instead of the marketing-site dashboard (link/QR hero, "Get live" list, stats and the general Manage
 * list). The public website still exists; the quiet row at the bottom is the only link to it.
 */
export async function SchedulingPortal({
  appId,
  timeZone,
  published,
  liveUrl,
}: {
  appId: string;
  timeZone: string;
  published: boolean;
  liveUrl: string;
}) {
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

  const [{ data: visits }, { data: customers }] = await Promise.all([
    supabase
      .from("schedule_visits")
      .select("*")
      .eq("app_id", appId)
      .gte("starts_at", todayBounds.start.toISOString())
      .lt("starts_at", nextWeekBounds.end.toISOString())
      .order("starts_at", { ascending: true }),
    supabase.from("schedule_customers").select("id, name").eq("app_id", appId).order("name", { ascending: true }),
  ]);

  const todayVisits = visitsWithin(visits ?? [], todayBounds);
  const nextWeekCount = countVisitsWithin(visits ?? [], nextWeekBounds, ["scheduled", "confirmed"]);
  const customerNames = new Map((customers ?? []).map((customer) => [customer.id, customer.name]));
  const customerCount = customers?.length ?? 0;

  // The Gmail connection and the Automation tables are private: read them only after the signed-in person is shown
  // to be an editor of this app.
  let editor = false;
  let gmailConnected = false;
  let gmailEmail: string | null = null;
  let remindersOn = false;
  let automationCount = 0;
  if (await isAppEditor(supabase, appId)) {
    editor = true;
    const admin = createAdminClient();
    const [gmail, reminder, automations] = await Promise.all([
      getConnectionStatus(appId),
      admin.from("reminder_settings").select("enabled").eq("app_id", appId).maybeSingle(),
      admin.from("automation_reminders").select("id", { count: "exact", head: true }).eq("app_id", appId).eq("enabled", true),
    ]);
    gmailConnected = gmail.connected;
    gmailEmail = gmail.email;
    remindersOn = reminder.data?.enabled ?? false;
    automationCount = automations.count ?? 0;
  }

  return (
    <>
      {/* The page header above already shows the app's name and its ADMIN pill, so the portal does not repeat them. */}
      <p className="text-sm text-neutral-500">Your day at a glance.</p>

      <section className={CARD}>
        <h2 className="text-lg font-semibold text-neutral-950">Today</h2>
        {todayVisits.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {todayVisits.map((visit) => {
              const status = STATUS[visit.status];
              const start = new Date(visit.starts_at);
              const end = new Date(start.getTime() + visit.duration_minutes * 60_000);
              return (
                <li
                  key={visit.id}
                  className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 ${
                    visit.status === "cancelled" ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums text-neutral-950">
                      {formatClock(start, timeZone)} – {formatClock(end, timeZone)}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-neutral-800">{customerNames.get(visit.customer_id) ?? "Customer"}</p>
                    <p className="truncate text-xs text-neutral-500">{visit.service || "Visit"}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">Nothing scheduled today.</p>
        )}
        <p className="mt-4 text-sm text-neutral-500">
          {nextWeekCount} {nextWeekCount === 1 ? "visit" : "visits"} in the next 7 days.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/dashboard/apps/${appId}/schedule`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Add a visit
          </Link>
          <Link
            href={`/dashboard/apps/${appId}/customers`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-neutral-900 ring-1 ring-black/10 transition hover:bg-neutral-50"
          >
            Add a customer
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href={`/dashboard/apps/${appId}/customers`}
          className="rounded-2xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-black/20"
        >
          <span className="block text-xs font-medium text-neutral-500">Customers</span>
          <span className="mt-1 block text-2xl font-semibold tabular-nums text-neutral-950">{customerCount}</span>
          <span className="block text-xs text-neutral-500">People you visit</span>
        </Link>

        <Link
          href={`/dashboard/apps/${appId}/reminders`}
          className="rounded-2xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-black/20"
        >
          <span className="block text-xs font-medium text-neutral-500">Reminders</span>
          {editor ? (
            gmailConnected ? (
              <>
                <span className="mt-1 block truncate text-sm font-medium text-neutral-950" title={gmailEmail ?? undefined}>
                  Connected as {gmailEmail}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">Automatic reminders: {remindersOn ? "On" : "Off"}</span>
              </>
            ) : (
              <>
                <span className="mt-1 block text-sm font-medium text-neutral-950">Connect Gmail</span>
                <span className="mt-0.5 block text-xs text-neutral-500">Reminders go out from your own inbox.</span>
              </>
            )
          ) : (
            <span className="mt-1 block text-sm font-medium text-neutral-950">Open reminders</span>
          )}
        </Link>

        <Link
          href={`/dashboard/apps/${appId}/automation`}
          className="rounded-2xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-black/20"
        >
          <span className="block text-xs font-medium text-neutral-500">Automation</span>
          {editor ? (
            <>
              <span className="mt-1 block text-sm font-medium text-neutral-950">
                {automationCount > 0 ? `${automationCount} ${automationCount === 1 ? "message" : "messages"} on` : "Nothing scheduled"}
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">Messages to people you choose</span>
            </>
          ) : (
            <span className="mt-1 block text-sm font-medium text-neutral-950">Open automation</span>
          )}
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-950">Business tools</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {BUSINESS_TOOLS.map(({ path, label, hint, icon: Icon }) => (
            <li key={path}>
              <Link
                href={`/dashboard/apps/${appId}/${path}`}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-black/20"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-950">{label}</span>
                  <span className="block truncate text-xs text-neutral-500">{hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-950">Website</p>
            <p className="text-xs text-neutral-500">Your public page is separate and optional.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/apps/${appId}/builder`}
              className="inline-flex h-9 items-center rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
            >
              Edit it
            </Link>
            {published && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
              >
                {liveUrl.replace(/^https?:\/\//, "")} <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
