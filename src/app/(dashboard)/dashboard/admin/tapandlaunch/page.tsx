import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { TodoBoard, type Todo } from "./TodoBoard";

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

/**
 * The to-do items the code knows about, in the order they are shown. Each is added to the list once (by its key) and keeps
 * its tick after that, so finished ones can be left here or removed later without coming back.
 */
const SEEDED: Array<{ key: string; section: string; title: string; detail?: string }> = [
  { key: "fitnessnav-key", section: "FitnessNav", title: "Add the Anthropic key to the FitnessNav reader, then tell Claude \"key added\"", detail: "One line in ~/.fitnessnav-job/.env. Then a 3-studio test and a full timed run." },
  { key: "stripe-connect-live", section: "Before real customers pay you (Stripe)", title: "Live store payments: Connect platform profile, connect the StageTimePNW store, one real purchase and refund", detail: "No store is connected in live mode yet. About 20 to 30 minutes clicking through Stripe." },
  { key: "stripe-phone", section: "Before real customers pay you (Stripe)", title: "Phone verification on the Stripe account, if Stripe still asks for it" },
  { key: "cleanup-firstrun3", section: "Before real customers pay you (Stripe)", title: "Delete the firstrun3 test account after its plan ends on Nov 4" },
  { key: "cleanup-shop1", section: "Before real customers pay you (Stripe)", title: "Delete the shop1 test account after the live store test" },
  { key: "vercel-test-domains", section: "Before real customers pay you (Stripe)", title: "Remove the 4 leftover tl-…test… domains in Vercel's Domains list", detail: "Vercel dashboard only; the API token can't do it." },
  { key: "ein-phone", section: "Later, optional", title: "EIN by phone: 1-800-829-4933, mention reference 101" },
  { key: "stripe-tax", section: "Later, optional", title: "Stripe Tax, after an accountant's advice on Washington sales tax for SaaS" },
  { key: "legal-review", section: "Before inviting real builders", title: "Lawyer review of Terms and Privacy" },
  { key: "byob-quality", section: "Before inviting real builders", title: "BYOB quality pass: a few real-key builds of different app types, then fixes", detail: "The parallel first build has mostly been timed against a stand-in." },
  { key: "byob-stage3", section: "Before inviting real builders", title: "BYOB Stage 3: click an element in the preview to edit it, image upload, GitHub export" },
  { key: "stage2-real-supabase", section: "Before inviting real builders", title: "Stage 2 with a real Supabase project, from the builder's Database button", detail: "About ten minutes." },
  { key: "seo-oct12", section: "Housekeeping", title: "SEO check around Oct 12" },
  { key: "delete-artifact", section: "Housekeeping", title: "Delete the redundant claude.ai dashboard page" },
];
const SECTIONS = ["FitnessNav", "Before real customers pay you (Stripe)", "Before inviting real builders", "Housekeeping", "Mine", "Later, optional"];

/** Platform admins only: the to-do list for today, then how the platform is doing. */
export default async function TapAndLaunchBoard() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const admin = createAdminClient();

  // Seed what the code knows about, once per key.
  const { data: existing } = await admin.from("admin_todos").select("key").not("key", "is", null);
  const have = new Set((existing ?? []).map((r) => r.key));
  const missing = SEEDED.filter((s) => !have.has(s.key)).map((s) => ({ key: s.key, section: s.section, title: s.title, detail: s.detail ?? null, sort: SEEDED.findIndex((x) => x.key === s.key) }));
  if (missing.length) await admin.from("admin_todos").insert(missing);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const [{ data: rows }, { count: orgs }, { count: liveApps }, { data: billing }, { count: openReports }] = await Promise.all([
    admin.from("admin_todos").select("id, key, title, detail, section, sort, created_at, done_at").order("sort").order("created_at"),
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin.from("apps").select("id", { count: "exact", head: true }).eq("status", "published").is("deleted_at", null),
    admin.from("org_billing").select("status"),
    admin.from("app_reports").select("id", { count: "exact", head: true }).is("resolved_at", null),
  ]);

  const dateOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
  const all = rows ?? [];
  const todos: Todo[] = all
    .filter((r) => !r.done_at || dateOf(r.done_at) === today)
    .map((r) => ({ id: r.id, key: r.key, title: r.title, detail: r.detail, section: r.section, done: !!r.done_at }));
  const doneEarlier = all.filter((r) => r.done_at && dateOf(r.done_at) !== today).length;
  const paid = (billing ?? []).filter((b) => b.status === "active").length;
  const trials = (billing ?? []).filter((b) => b.status === "trialing").length;
  const nowLabel = new Date().toLocaleString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <main className="flex-1 bg-neutral-100/70">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Super admin · daily board</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">TapAndLaunch</h1>
              <p className="mt-2 max-w-xl text-sm text-neutral-400">{nowLabel}. What&apos;s open rolls over until you tick it.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/dashboard/admin/fitnessnav" className="inline-flex h-10 items-center rounded-full px-4 font-medium text-neutral-300 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white">
                FitnessNav board
              </Link>
              <Link href="/dashboard/admin" className="inline-flex h-10 items-center rounded-full px-4 font-medium text-neutral-300 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white">
                Customers
              </Link>
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 lg:grid-cols-4">
            <Stat label="Customers" value={orgs ?? 0} />
            <Stat label="Live apps" value={liveApps ?? 0} />
            <Stat label="Paid plans" value={paid} sub={`${trials} on trial`} />
            <Stat label="Open reports" value={openReports ?? 0} sub={openReports ? "needs a look" : "none"} tone={openReports ? "warn" : "good"} />
          </dl>
        </div>
      </section>

      <div className="relative mx-auto -mt-10 w-full max-w-6xl space-y-6 px-6 pb-16">
        <TodoBoard todos={todos} sections={SECTIONS} doneEarlier={doneEarlier} />
        <section className="rounded-3xl bg-white p-6 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
          <h2 className="text-lg font-semibold tracking-tight">How this list works</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-700">
            <li>Tick a box when something is done. It moves to &ldquo;Done today&rdquo; and drops off tomorrow.</li>
            <li>Anything you don&apos;t tick is still here tomorrow. Nothing is lost by not finishing.</li>
            <li>Add your own items with the box above; the trash icon removes those. Items Claude put here are ticked off, not removed.</li>
            <li>The StageTime launch (Oct 23) has its own list with the StageTime agent and is not on this board.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "good" | "warn" }) {
  return (
    <div className="bg-neutral-950/60 px-5 py-4">
      <dt className="text-xs font-medium text-neutral-400">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums">{value.toLocaleString("en-US")}</dd>
      {sub && <dd className={`mt-1 text-xs ${tone === "warn" ? "text-amber-300" : tone === "good" ? "text-emerald-300" : "text-neutral-400"}`}>{sub}</dd>}
    </div>
  );
}
