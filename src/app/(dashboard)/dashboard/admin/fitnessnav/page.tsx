import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { getClassWeek } from "@/lib/fitness/classes";
import { CLASS_TYPE_LABEL, hasStarted, seattleStamp, seattleToday, type FitnessClass } from "@/lib/fitness/schedule";
import type { FitnessClassType } from "@/types/database";
import { TodoBoard } from "../tapandlaunch/TodoBoard";
import { loadBoardTodos, type SeededTodo } from "@/lib/admin/todos";

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

/** Why a studio has nothing listed, from the reader's status for it. */
const STATUS_LABEL: Record<string, { label: string; tone: "good" | "warn" | "bad" | "muted" }> = {
  ok: { label: "Reading", tone: "good" },
  blocked_robots: { label: "Blocks readers", tone: "bad" },
  no_schedule: { label: "No readable schedule", tone: "warn" },
  error: { label: "Read failed", tone: "warn" },
  skipped: { label: "No group classes", tone: "muted" },
};

const TYPE_COLOR: Record<FitnessClassType, string> = { pilates: "bg-pink-600", yoga: "bg-emerald-600", lifting: "bg-blue-600", spin: "bg-amber-500", climbing: "bg-orange-800" };

/** What needs doing on FitnessNav, with the steps to follow. Added to the board's list once by key; ticks are kept. */
// Nothing seeded right now. The "add the Anthropic key" item was dropped on Oct 6: the local Qwen model stays the reader.
const TODOS: SeededTodo[] = [];
const TODO_SECTIONS = ["Reader", "Studios", "Mine"];

/** What shipped, newest first. Kept here on purpose: it changes when the work ships, with the same commit. */
const BUILT: Array<{ when: string; items: string[] }> = [
  {
    when: "Oct 6",
    items: [
      "A safety net: a bad read can never replace a good week on the site (7 studios protected on the first morning).",
      "Inspire (both), Ahimsa, be here now. and TRIBE read from their booking widget's own data: exact times, no model, no more wrong-week results.",
      "The app was silently showing only the first 1,000 classes; it now shows the whole week.",
      "Phone polish: the fold control says \"Show less\" / \"Show all 52\" and a folded group keeps its first class in view; the name no longer gets clipped by the location pill; class rows are about half as tall (Book sits under the time, the name has the full width); two header lines instead of four; \"under 0.1 mi\" instead of \"0.0 mi\".",
      "After the first Search, ticking a class type updates the list straight away. Search scrolls to the results and keeps the day in view when the new picks have classes there.",
      "The day strip peeks the next day and follows the chosen day; a studio tap keeps the day; the location pill explains itself when the browser can't help; \"Try again\" when the schedule fails to load; a darker orange that passes the contrast bar; screen-reader announcements and focus sorted out.",
      "Downtown Seattle, Belltown, Pioneer Square and Chinatown-International District searched: 9 studios added. Fixed a second case of one page mixing locations: Breathe Hot Yoga (Capitol Hill, now with Belltown) and Flow Fitness (Fremont, now with South Lake Union) were showing every club's classes under one name.",
      "Next to Capitol Hill: 11 studios added (Central District, Eastlake, South Lake Union, Montlake), each checked against its own calendar. Also fixed: Seattle Strength Queen Anne was showing classes from five other locations; it now keeps only its own.",
      "Experience Momentum (Fremont) reads from its Mindbody schedule: 39 classes live. JETSET, Coeur, Cambio and Studio Jacks are marked with why they can't be read; Seed stays in the list until it posts classes.",
      "The reader runs every night at 10 PM instead of 10 AM, still on the local Qwen model, so the page is fresh by morning.",
      "Claude as the reader is built but parked: no key for now; the local model does the job.",
      "This board.",
    ],
  },
  {
    when: "Oct 5",
    items: [
      "Nothing is ticked until the visitor picks; the page opens on today and shows only classes still to come.",
      "Each studio has its own color; tap a studio's name to see only that studio.",
      "Morning / Afternoon / Evening fold and unfold; a clear \"There are no Pilates classes at this time\" message.",
      "Location: the page asks where the visitor is and sorts by Soonest or Nearest.",
      "Capitol Hill added: 11 studios. The reader remembers schedule pages and reads 3 studios at once.",
    ],
  },
  {
    when: "Oct 4",
    items: [
      "FitnessNav live: every Pilates, yoga, spin, lifting and climbing class near Fremont, by day, with Book links.",
      "The reader: a job on the Mac reads each studio's own schedule page every day (10 AM at first; every night at 10 PM since Oct 6).",
    ],
  },
];

const ROADMAP: Array<{ title: string; detail: string; status: "done" | "waiting" | "now" | "later" }> = [
  { title: "Capitol Hill", detail: "12 of 20 candidate studios read and live. Done Oct 5 to 6.", status: "done" },
  { title: "Downtown, Belltown and Chinatown-ID", detail: "Done Oct 6. 9 studios added (Atlas, Club Pilates Queen Anne, Innerland, Kinesia, Mind.Body.Hum, Mother Yoga, Take Care, Belltown Strength, Persistence). Chinatown-ID has few class studios. Held back: Bodytonic, Cue Fitness (every class named just \"Fitness Class\"), CorePower Belltown, Barry's, SoulCycle. No readable schedule: Demco, Emerald City Pilates, Northwest Strong, Seattle Athletic Club, ZUM, Bouldering Project Poplar.", status: "done" },
  { title: "Neighborhoods next to Capitol Hill", detail: "Done Oct 6: Central District, Eastlake, South Lake Union, Montlake, First Hill, Madison Park. 11 of 36 candidates added. Held back (partial or tricky reads): Barry's, SoulCycle, Pure Barre, CorePower Belltown, KlickWay. Not readable: F45 Central District, Eighth Haus, OmCulture and others.", status: "done" },
  { title: "Mariana Tek studios read exactly", detail: "Five of the busiest studios, from their widget's own data. Done Oct 6.", status: "done" },
  { title: "Faster reads with Claude", detail: "Built and parked Oct 6: the local Qwen model stays the reader. An Anthropic key in the job's .env turns it on any time; the 95-minute run would drop to minutes.", status: "later" },
  { title: "Studios that still don't read", detail: "Done Oct 6. Experience Momentum now reads from its Mindbody page (39 classes). The rest can't be read for good reasons: JETSET isn't open yet, Coeur opens Nov 9, Cambio and Studio Jacks are appointments only, Seed's calendar has no classes posted (the job keeps checking). Posto and Bouldering Project block readers.", status: "done" },
  { title: "Speed-ups for the model path", detail: "Trim menus and footers before the model reads a page; skip days that haven't changed; a smaller model for clean pages. After about 60 studios.", status: "later" },
  { title: "More booking-system readers", detail: "Mindbody, Walla, Momence, WellnessLiving, Glofox: the same exact-data trick as Mariana Tek.", status: "later" },
  { title: "Only send nearby studios to the page", detail: "The app downloads the whole city's week. With more neighborhoods it should send only what's near the visitor.", status: "later" },
  { title: "Visitors choose an area", detail: "Decided Oct 5: later. For now the visitor's own location decides.", status: "later" },
];

const AHEAD: Array<{ area: string; hoods: string }> = [
  { area: "North Seattle", hoods: "Wallingford · Green Lake · Phinney Ridge · Greenwood · U-District & University Village · Ravenna & Roosevelt · Laurelhurst & Windermere · Wedgwood, Bryant & View Ridge · Sand Point & Magnuson · Lake City · Northgate · Broadview & Bitter Lake" },
  { area: "Central & Downtown", hoods: "Downtown / Waterfront · Belltown · Pioneer Square · Chinatown-ID · First Hill · South Lake Union · Denny Triangle · Magnolia · Interbay · Eastlake & Westlake · Central District" },
  { area: "South Seattle", hoods: "Beacon Hill · Rainier Valley · SoDo · Georgetown · South Park · Seward Park · NewHolly" },
  { area: "West Seattle", hoods: "Alki · North Admiral · The Junction · Fauntleroy · Delridge · Gatewood & Genesee · Arbor Heights & Westwood" },
];

const CHIP: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  bad: "bg-red-50 text-red-700 ring-red-200",
  muted: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  waiting: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  now: "bg-amber-50 text-amber-800 ring-amber-200",
  later: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};
const STATUS_TEXT: Record<string, string> = { done: "Done", waiting: "Waiting on key", now: "In progress", later: "Later" };

/** Platform admins only: how FitnessNav is doing today, what has shipped, and what is next. */
export default async function FitnessNavBoard() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();

  const admin = createAdminClient();
  const { todos, doneEarlier } = await loadBoardTodos(admin, "fitnessnav", TODOS);
  const { data: app } = await admin.from("apps").select("id, slug").eq("slug", "fitnessnav").is("deleted_at", null).neq("kind", "code").maybeSingle();

  const today = seattleToday();
  const now = seattleStamp();
  const week = app ? await getClassWeek(app.id, today) : null;
  const { data: studioRows } = app ? await admin.from("fitness_studios").select("id, name, neighborhood, read_status, read_at, class_count").eq("app_id", app.id) : { data: null };

  const classes: FitnessClass[] = week?.classes ?? [];
  const byStudio = new Map<string, number>();
  for (const c of classes) byStudio.set(c.studioId, (byStudio.get(c.studioId) ?? 0) + 1);
  const studios = (studioRows ?? [])
    .map((s) => ({ ...s, thisWeek: byStudio.get(s.id) ?? 0 }))
    .sort((a, b) => b.thisWeek - a.thisWeek || a.name.localeCompare(b.name));
  const reading = studios.filter((s) => s.thisWeek > 0).length;
  const todays = classes.filter((c) => c.date === today);
  const stillToCome = todays.filter((c) => !hasStarted(c, now)).length;
  const lastRead = studios.reduce<string | null>((max, s) => (s.read_at && (!max || s.read_at > max) ? s.read_at : max), null);
  const readDate = lastRead ? new Date(lastRead) : null;
  const readIsToday = readDate ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(readDate) === today : false;

  const types = (Object.keys(CLASS_TYPE_LABEL) as FitnessClassType[]).map((k) => ({ key: k, label: CLASS_TYPE_LABEL[k], n: classes.filter((c) => c.type === k).length }));
  const days = (week?.days ?? []).map((d) => ({ key: d, label: `${new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" })} ${Number(d.slice(8, 10))}`, n: classes.filter((c) => c.date === d).length }));
  const maxType = Math.max(1, ...types.map((t) => t.n));
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const time = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  const date = (d: Date) => d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
  const nowLabel = time(new Date());

  return (
    <main className="flex-1 bg-neutral-100/70">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-orange-600/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Super admin · daily board</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">FitnessNav</h1>
              <p className="mt-2 max-w-xl text-sm text-neutral-400">Live from the database as of {nowLabel} Seattle time. Reload for fresh numbers.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/dashboard/admin" className="inline-flex h-10 items-center rounded-full px-4 font-medium text-neutral-300 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white">
                Customers
              </Link>
              <a href="https://fitnessnav.tapandlaunch.com" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full bg-white px-4 font-semibold text-neutral-950 transition hover:bg-orange-50">
                Open the app ↗
              </a>
            </div>
          </div>

          {!app ? (
            <p className="mt-8 rounded-2xl bg-white/10 px-5 py-4 text-sm text-neutral-200 ring-1 ring-white/10">No app with the address fitnessnav is published here, so there is nothing to show yet.</p>
          ) : (
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 lg:grid-cols-4">
              <div className="bg-neutral-950/60 px-5 py-4">
                <dt className="text-xs font-medium text-neutral-400">Classes this week</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{classes.length.toLocaleString("en-US")}</dd>
                <dd className="mt-1 text-xs text-neutral-400">{todays.length} today</dd>
              </div>
              <div className="bg-neutral-950/60 px-5 py-4">
                <dt className="text-xs font-medium text-neutral-400">Still to come today</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{stillToCome}</dd>
                <dd className="mt-1 text-xs text-neutral-400">what a visitor sees right now</dd>
              </div>
              <div className="bg-neutral-950/60 px-5 py-4">
                <dt className="text-xs font-medium text-neutral-400">Studios with classes</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {reading}
                  <span className="text-lg text-neutral-400">/{studios.length}</span>
                </dd>
                <dd className="mt-1 text-xs text-neutral-400">{studios.length - reading} not reading</dd>
              </div>
              <div className="bg-neutral-950/60 px-5 py-4">
                <dt className="text-xs font-medium text-neutral-400">Schedules last read</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{readDate ? time(readDate) : "—"}</dd>
                <dd className={`mt-1 text-xs ${readIsToday ? "text-emerald-300" : "text-amber-300"}`}>{readDate ? (readIsToday ? `today, ${date(readDate)}` : `${date(readDate)} · not yet today`) : "never"}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <div className="relative mx-auto -mt-10 w-full max-w-6xl space-y-6 px-6 pb-16">
        <TodoBoard board="fitnessnav" todos={todos} sections={TODO_SECTIONS} doneEarlier={doneEarlier} />
        {app && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="By kind of class">
              <Bars rows={types.map((t) => ({ label: t.label, n: t.n, width: (t.n / maxType) * 100, color: TYPE_COLOR[t.key] }))} />
              <p className="mt-3 text-xs text-neutral-500">Rock climbing stays hidden on the app until a climbing gym can be read.</p>
            </Card>
            <Card title="By day">
              <Bars rows={days.map((d) => ({ label: d.label, n: d.n, width: (d.n / maxDay) * 100, color: d.key === today ? "bg-orange-500" : "bg-neutral-800" }))} />
              <p className="mt-3 text-xs text-neutral-500">The app shows only classes still to come, so today&apos;s count on the app falls through the day.</p>
            </Card>
          </div>
        )}

        {app && (
          <Card title="Studios" aside="Sorted by classes this week. Status is from the last read.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="py-2 pr-3">Studio</th>
                    <th className="py-2 pr-3">Neighborhood</th>
                    <th className="py-2 pr-3 text-right">This week</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {studios.map((s) => {
                    const st = STATUS_LABEL[s.read_status ?? ""] ?? { label: s.read_status ?? "Unknown", tone: "muted" as const };
                    const tone = s.thisWeek > 0 ? STATUS_LABEL.ok! : st;
                    return (
                      <tr key={s.id}>
                        <td className="py-2 pr-3 font-medium">{s.name}</td>
                        <td className="py-2 pr-3 text-neutral-500">{s.neighborhood ?? "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{s.thisWeek || "—"}</td>
                        <td className="py-2">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${CHIP[tone.tone]}`}>{tone.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="What we built">
            <ol className="divide-y divide-neutral-100">
              {BUILT.map((b) => (
                <li key={b.when} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[5rem_1fr]">
                  <p className="font-semibold text-orange-700">{b.when}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {b.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Roadmap">
            <ol className="space-y-2">
              {ROADMAP.map((r, i) => (
                <li key={r.title} className={`grid grid-cols-[2rem_1fr_auto] items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${r.status === "now" || r.status === "waiting" ? "bg-orange-50/60 ring-orange-200" : "bg-neutral-50 ring-neutral-100"}`}>
                  <span className={`text-xl font-semibold tabular-nums ${r.status === "done" ? "text-emerald-600" : "text-neutral-400"}`}>{r.status === "done" ? "✓" : i - 1}</span>
                  <div>
                    <p className="font-semibold">{r.title}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{r.detail}</p>
                  </div>
                  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${CHIP[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card title="Neighborhoods ahead" aside="Fremont, Ballard, Queen Anne and Capitol Hill are in. Each new one takes a studio search, a test-read and a save.">
          <div className="grid gap-4 sm:grid-cols-2">
            {AHEAD.map((a) => (
              <div key={a.area}>
                <p className="font-semibold">{a.area}</p>
                <p className="mt-1 text-sm text-neutral-600">{a.hoods}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Your daily glance">
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
            <li>
              <b>Studios with classes</b> should stay at {Math.max(reading, 36)} or climb. If it drops, the run last night had trouble: ask Claude to read the log.
            </li>
            <li>
              <b>Schedules last read</b> should say yesterday (the run is at 10 PM and takes about 95 minutes). If it is older, the Mac was asleep at 10 PM; the run starts when it wakes.
            </li>
            <li>
              <b>Still to come today</b> is what a visitor sees now. If it looks low for the hour, check one busy studio against its own site.
            </li>
          </ul>
        </Card>
      </div>
    </main>
  );
}

function Card({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {aside && <p className="text-xs text-neutral-500">{aside}</p>}
      </div>
      {children}
    </section>
  );
}

function Bars({ rows }: { rows: Array<{ label: string; n: number; width: number; color: string }> }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
            <div className={`h-full rounded-full ${r.color}`} style={{ width: `${Math.round(r.width)}%` }} />
          </div>
          <span className="text-right font-semibold tabular-nums">{r.n.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}
