import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowUpRight, BarChart3, Bell, CalendarDays, Download, Fuel, Inbox, Pencil, ShoppingBag, Smartphone, Ticket, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { appLiveUrl } from "@/lib/apps/share";
import { getChecklists } from "@/lib/apps/signals";
import { tileGradient, tileInitial } from "@/lib/apps/tile";
import { CopyButton } from "@/components/dashboard/CopyButton";

type Params = Promise<{ appId: string }>;

const MANAGE = [
  { path: "analytics", label: "Analytics", hint: "Views, installs and where people go", icon: BarChart3 },
  { path: "members", label: "Members", hint: "Who has signed up", icon: Users },
  { path: "notifications", label: "Notifications", hint: "Send a push, email or text", icon: Bell },
  { path: "submissions", label: "Submissions", hint: "Messages from your forms", icon: Inbox },
  { path: "products", label: "Products", hint: "What you sell", icon: ShoppingBag },
  { path: "orders", label: "Orders", hint: "Who bought what", icon: ShoppingBag },
  { path: "events", label: "Events", hint: "Dates people can book", icon: CalendarDays },
  { path: "bookings", label: "Bookings", hint: "Who booked", icon: Ticket },
  { path: "gas-stations", label: "Gas stations", hint: "Prices and reports", icon: Fuel },
];

/** The app's home: where it stands, the link and QR code to open it on a phone, and the way into everything else. */
export default async function AppHomePage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("*").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 7);
  const since = sinceDate.toISOString();
  const [checklists, views, installs, members, subscribers] = await Promise.all([
    getChecklists(supabase, [app]),
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("app_id", appId).eq("event_type", "view").gte("created_at", since),
    supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("app_id", appId).eq("event_type", "install").gte("created_at", since),
    supabase.from("app_members").select("id", { count: "exact", head: true }).eq("app_id", appId),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("app_id", appId),
  ]);
  const checklist = checklists.get(app.id);

  const published = app.status === "published";
  const liveUrl = appLiveUrl(app, getRootDomain());
  const shown = liveUrl.replace(/^https?:\/\//, "");
  const tile = tileGradient(app.id);
  const brand = app.theme.primary_color;
  const iconUrl = app.manifest.icon_url;

  // Both pictures are made here from the address, nothing leaves the server.
  const qrSvg = published ? await QRCode.toString(liveUrl, { type: "svg", margin: 1, color: { dark: "#0a0a0a", light: "#ffffff" } }) : null;
  const qrPng = published ? await QRCode.toDataURL(liveUrl, { width: 1024, margin: 2 }) : null;

  return (
    <main className="flex-1 bg-neutral-100/70">
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center gap-4">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
            <img src={iconUrl} alt="" className="h-16 w-16 rounded-2xl object-cover shadow ring-1 ring-black/5" />
          ) : (
            <span
              className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br text-2xl font-bold text-white shadow ${brand ? "" : tile.classes}`}
              style={brand ? { background: brand } : undefined}
            >
              {tileInitial(app.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-950">{app.name}</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-neutral-500">
              <span className={`h-2 w-2 rounded-full ${published ? "bg-emerald-500" : "bg-neutral-400"}`} />
              {published ? "Live" : "Draft, not published yet"}
            </p>
          </div>
          <Link
            href={`/dashboard/apps/${appId}/builder`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            <Pencil className="h-4 w-4" /> Open builder
          </Link>
        </header>

        <section className="grid gap-6 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:grid-cols-[1fr_auto]">
          {published && qrSvg && qrPng ? (
            <>
              <div className="min-w-0 space-y-4">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-950">
                    <Smartphone className="h-5 w-5 text-neutral-500" /> Open it on your phone
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">Point your phone&apos;s camera at the code, or send yourself the link. Then try it the way your customers will.</p>
                </div>
                <p className="truncate rounded-2xl bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 ring-1 ring-black/5">{shown}</p>
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={liveUrl} />
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
                  >
                    Open <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <a
                    href={qrPng}
                    download={`${app.slug}-qr.png`}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
                  >
                    <Download className="h-4 w-4" /> Download QR
                  </a>
                </div>
              </div>
              <div
                role="img"
                aria-label={`QR code that opens ${shown}`}
                className="mx-auto h-44 w-44 shrink-0 overflow-hidden rounded-2xl bg-white p-1 ring-1 ring-black/10 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </>
          ) : (
            <div className="space-y-3 sm:col-span-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-950">
                <Smartphone className="h-5 w-5 text-neutral-500" /> Open it on your phone
              </h2>
              <p className="text-sm text-neutral-500">
                Publish the app and its link and QR code appear here. You can unpublish again any time, so it&apos;s safe to try.
              </p>
              <Link
                href={`/dashboard/apps/${appId}/builder`}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Go to the builder to publish
              </Link>
            </div>
          )}
        </section>

        {checklist && !checklist.complete && (
          <section className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-neutral-950">Get live</h2>
              <p className="text-sm tabular-nums text-neutral-500">
                {checklist.doneCount} of {checklist.total}
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {checklist.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${step.done ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500"}`}
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <span className={step.done ? "text-neutral-400 line-through" : "text-neutral-800"}>
                    {step.title}
                    {!step.done && step.id === checklist.next?.id && step.hint && <span className="mt-0.5 block text-xs text-neutral-500">{step.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <dl className={`grid grid-cols-2 gap-3 ${app.kind === "code" ? "" : "sm:grid-cols-4"}`}>
          <Stat label="Views" value={views.count ?? 0} sub="last 7 days" />
          <Stat label="Installs" value={installs.count ?? 0} sub="last 7 days" />
          {app.kind !== "code" && <Stat label="Members" value={members.count ?? 0} />}
          {app.kind !== "code" && <Stat label="Notification subscribers" value={subscribers.count ?? 0} />}
        </dl>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-neutral-950">Manage</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {/* An AI-written app has no blocks, so no members, forms, products, events or stations to manage: just its numbers. */}
            {(app.kind === "code" ? MANAGE.filter((m) => m.path === "analytics") : MANAGE).map(({ path, label, hint, icon: Icon }) => (
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
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-neutral-950">{value.toLocaleString()}</dd>
      {sub && <p className="text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
