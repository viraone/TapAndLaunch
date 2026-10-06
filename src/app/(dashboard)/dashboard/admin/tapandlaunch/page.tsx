import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { TodoBoard } from "./TodoBoard";
import { loadBoardTodos, type SeededTodo } from "@/lib/admin/todos";

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

/**
 * The to-do items the code knows about, in the order they are shown. Each item and each step is added to the list once
 * (by its key) and keeps its tick after that, so finished ones can be left here or removed later without coming back.
 */
const SEEDED: SeededTodo[] = [
  {
    key: "stripe-connect-live",
    section: "Before real customers pay you (Stripe)",
    title: "Live store payments: connect a store in live mode and make one real purchase and refund",
    detail: "No store is connected in live mode yet. About 20 to 30 minutes clicking through Stripe.",
    steps: [
      { title: "In Stripe with the sandbox switch off: Settings → Connect → Platform profile. Answer the questions and submit.", detail: "You run a platform; your users sell goods and services from their own stores; Stripe hosts their onboarding." },
      { title: "Settings → Connect → Branding: name TapAndLaunch, upload the icon, set the brand color.", detail: "Store owners see this on Stripe's onboarding pages." },
      { title: "In TapAndLaunch (StageTimePNW workspace): Settings → Payments → Connect Stripe. Follow Stripe's live onboarding with your real details.", detail: "Identity and bank details go into Stripe only, never into chat or screenshots." },
      { title: "Back in TapAndLaunch Settings → Payments: it should say connected with charges enabled. If not, send Claude a screenshot." },
      { title: "Add an Online store block with one $1 test product to a page in one of your apps (or make a quick app from the Online store template), and publish." },
      { title: "On the live app, buy the $1 product with your own card. In the dashboard, the order should show Paid." },
      { title: "In Stripe: Payments → that payment → Refund. The order should then show Refunded." },
      { title: "Tell Claude \"store test done\".", detail: "Claude checks the webhook deliveries and the order rows; then the test product comes off." },
    ],
  },
  {
    key: "stripe-phone",
    section: "Before real customers pay you (Stripe)",
    title: "Phone verification on the Stripe account, if Stripe still asks for it",
    steps: [{ title: "Stripe → Settings → Business → Account details. If a verification banner shows, follow it. If nothing is asked, tick this." }],
  },
  {
    key: "cleanup-firstrun3",
    section: "Before real customers pay you (Stripe)",
    title: "Delete the firstrun3 test account after its plan ends on Nov 4",
    steps: [
      { title: "On or after Nov 5: Admin → Customers → the \"tesghhdyfjfgh\" workspace → delete it (or tell Claude to)." },
      { title: "Tell Claude to delete the firstrun3 login too." },
    ],
  },
  {
    key: "cleanup-shop1",
    section: "Before real customers pay you (Stripe)",
    title: "Delete the shop1 test account after the live store test",
    steps: [{ title: "Once the live store test above passes: tell Claude \"delete shop1\"." }],
  },
  {
    key: "vercel-test-domains",
    section: "Before real customers pay you (Stripe)",
    title: "Remove the 4 leftover tl-…test… domains in Vercel's Domains list",
    detail: "Vercel dashboard only; the API token can't do it.",
    steps: [
      { title: "vercel.com → your team → Domains (top tab)." },
      { title: "Find the entries starting with tl- that contain test. There should be 4. Leave tapandlaunch.com and tapandlaunch.app alone." },
      { title: "For each one: the ⋯ menu → Delete → confirm." },
    ],
  },
  {
    key: "ein-phone",
    section: "Later, optional",
    title: "EIN by phone",
    steps: [
      { title: "Call 1-800-829-4933 (IRS Business & Specialty Tax Line), Monday to Friday, 7 AM to 7 PM." },
      { title: "Say the online form gave reference 101 for a sole proprietor EIN. Have your SSN and address ready (for the IRS only, never for Claude)." },
      { title: "Write the EIN into docs/private/business.md only (ask Claude to; don't paste it in chat)." },
    ],
  },
  { key: "stripe-tax", section: "Later, optional", title: "Stripe Tax, after an accountant's advice on Washington sales tax for SaaS" },
  { key: "legal-review", section: "Before inviting real builders", title: "Lawyer review of Terms and Privacy" },
  {
    key: "byob-quality",
    section: "Before inviting real builders",
    title: "BYOB quality pass: real-key builds of different app types, then fixes",
    detail: "The parallel first build has mostly been timed against a stand-in.",
    steps: [
      { title: "Create 3 apps from Bring your own bot with your own key: a booking app, a menu and ordering app, and a community app with sign-in." },
      { title: "Note what's wrong or slow in each (screenshots help) and send it to Claude." },
      { title: "Claude fixes the prompts and code. Build the same three once more and compare." },
    ],
  },
  { key: "byob-stage3", section: "Before inviting real builders", title: "BYOB Stage 3: click an element in the preview to edit it, image upload, GitHub export" },
  {
    key: "stage2-real-supabase",
    section: "Before inviting real builders",
    title: "Stage 2 with a real Supabase project, from the builder's Database button",
    detail: "About ten minutes.",
    steps: [
      { title: "supabase.com/dashboard/new: create a free project, any name." },
      { title: "Project Settings → API Keys: copy the Project URL and the anon / publishable key (not the secret one)." },
      { title: "In a BYOB app: Database button → paste both → Connect database." },
      { title: "Ask the AI: \"let people make an account and save their tasks\". Copy the SQL it writes, run it in Supabase's SQL editor, then click I ran it." },
      { title: "In the preview: sign up, add a task, reload. It should still be there. Tell Claude how it went." },
    ],
  },
  { key: "seo-oct12", section: "Housekeeping", title: "SEO check around Oct 12", steps: [{ title: "On Oct 12 or later, type /seo in Claude Code. It audits tapandlaunch.com and fixes what it finds." }] },
  { key: "delete-artifact", section: "Housekeeping", title: "Delete the redundant claude.ai dashboard page", steps: [{ title: "Tell Claude \"delete the claude.ai dashboard\"." }] },
];
const SECTIONS = ["Before real customers pay you (Stripe)", "Before inviting real builders", "Housekeeping", "Mine", "Later, optional"];

/** Platform admins only: the to-do list for today, then how the platform is doing. */
export default async function TapAndLaunchBoard() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const admin = createAdminClient();

  const { todos, doneEarlier } = await loadBoardTodos(admin, "tapandlaunch", SEEDED);

  const [{ count: orgs }, { count: liveApps }, { data: billing }, { count: openReports }] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin.from("apps").select("id", { count: "exact", head: true }).eq("status", "published").is("deleted_at", null),
    admin.from("org_billing").select("status"),
    admin.from("app_reports").select("id", { count: "exact", head: true }).is("resolved_at", null),
  ]);
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
        <TodoBoard board="tapandlaunch" todos={todos} sections={SECTIONS} doneEarlier={doneEarlier} />
        <section className="rounded-3xl bg-white p-6 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
          <h2 className="text-lg font-semibold tracking-tight">How this list works</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-700">
            <li>An item with steps shows &ldquo;0 of N steps&rdquo;: open it and tick the steps as you go. The last step ticked finishes the item.</li>
            <li>Tick an item itself when it&apos;s done. It moves to &ldquo;Done today&rdquo; and drops off tomorrow. Untick to bring it back.</li>
            <li>Anything you don&apos;t tick is still here tomorrow. Nothing is lost by not finishing.</li>
            <li>Add your own items with the box; the trash icon removes those. Items Claude put here are ticked off, not removed.</li>
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
