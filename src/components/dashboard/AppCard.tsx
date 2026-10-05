import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpRight, Eye, MoreHorizontal, Pencil } from "lucide-react";
import type { Database } from "@/types/database";
import { tileGradient, tileInitial } from "@/lib/apps/tile";
import type { Checklist } from "@/lib/apps/checklist";
import { DeleteAppDialog, DeleteAppMenuItem } from "@/components/dashboard/DeleteAppDialog";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];

const MANAGE_LINKS = [
  { path: "analytics", label: "Analytics" },
  { path: "submissions", label: "Submissions" },
  { path: "members", label: "Members" },
  { path: "notifications", label: "Notifications" },
  { path: "products", label: "Products" },
  { path: "orders", label: "Orders" },
  { path: "events", label: "Events" },
  { path: "bookings", label: "Bookings" },
  { path: "gas-stations", label: "Gas stations" },
];

/** Views per day, oldest first (7 entries). */
export type DailyViews = number[];

/**
 * One app on the dashboard: a cover in the app's own brand colour with its
 * last-7-days views drawn across it, then name, address and actions.
 */
export function AppCard({ app, rootDomain, views, checklist, canDelete = false }: { app: AppRow; rootDomain: string; views: DailyViews; checklist?: Checklist; canDelete?: boolean }) {
  // AI-written apps live on their own domain once it's set up (see getCodeAppsDomain).
  const appRoot = app.kind === "code" ? (process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN?.trim().toLowerCase() || rootDomain) : rootDomain;
  const previewUrl = `//${app.slug}.${appRoot}`;
  // Taken down by TapAndLaunch: not live, whatever its status says.
  const takenDown = app.suspended_at !== null && app.suspended_at !== undefined;
  const published = app.status === "published" && !takenDown;
  const iconUrl = app.manifest.icon_url;
  const tile = tileGradient(app.id);
  const brand = app.theme.primary_color ?? tile.from;
  const cover = app.theme.primary_color
    ? `linear-gradient(135deg, ${brand} 0%, color-mix(in oklab, ${brand} 45%, #0a0a0a) 100%)`
    : `linear-gradient(135deg, ${tile.from} 0%, ${tile.to} 100%)`;
  const total = views.reduce((a, b) => a + b, 0);

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.28)]"
      style={{ ["--brand" as string]: brand }}
    >
      <div className="relative h-32 overflow-hidden" style={{ background: cover }}>
        <div aria-hidden className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.18)_1px,transparent_0)] [background-size:14px_14px] opacity-40" />
        <Sparkline values={views} />
        <span
          className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${
            published ? "bg-black/25 text-white ring-1 ring-white/25" : "bg-white/80 text-neutral-700"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {published && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />}
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${published ? "bg-emerald-300" : "bg-neutral-400"}`} />
          </span>
          {takenDown ? "Taken down" : published ? "Live" : "Draft"}
        </span>
        <span className="absolute left-4 top-3.5 text-[11px] font-semibold text-white/90 tabular-nums">
          {total.toLocaleString()} {total === 1 ? "view" : "views"} · 7d
        </span>
      </div>

      <div className="relative flex flex-1 flex-col px-5 pb-5">
        <div className="-mt-8 mb-3">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
            <img src={iconUrl} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-lg ring-4 ring-white" />
          ) : (
            <span
              className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br text-2xl font-bold text-white shadow-lg ring-4 ring-white ${app.theme.primary_color ? "" : tile.classes}`}
              style={app.theme.primary_color ? { background: cover } : undefined}
            >
              {tileInitial(app.name)}
            </span>
          )}
        </div>
        <h2 className="truncate text-lg font-semibold tracking-tight text-neutral-950">
          <Link href={`/dashboard/apps/${app.id}`} className="hover:underline">
            {app.name}
          </Link>
        </h2>
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-sm text-neutral-500 transition hover:text-neutral-950"
        >
          <span className="truncate">
            {app.slug}.{appRoot}
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
        </a>

        {checklist && !checklist.complete && checklist.next && (
          <Link
            href={`/dashboard/apps/${app.id}/builder`}
            className="mt-4 block rounded-2xl bg-neutral-50 p-3 ring-1 ring-black/5 transition hover:bg-neutral-100"
          >
            <span className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-neutral-950">Get live</span>
              <span className="tabular-nums text-neutral-500">
                {checklist.doneCount} of {checklist.total}
              </span>
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500"
                style={{ width: `${(checklist.doneCount / checklist.total) * 100}%` }}
              />
            </span>
            <span className="mt-2 block truncate text-xs text-neutral-500">
              Next: <span className="font-medium text-neutral-800">{checklist.next.title}</span>
            </span>
          </Link>
        )}

        <div className="mt-5 flex items-center gap-2">
          <Link
            href={`/dashboard/apps/${app.id}/builder`}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            <Pencil className="h-4 w-4" /> Open builder
          </Link>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Visit ${app.name}`}
            title="Visit app"
            className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200 hover:text-neutral-950"
          >
            <Eye className="h-4 w-4" />
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Manage ${app.name}`}
              className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200 hover:text-neutral-950"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/dashboard/apps/${app.id}`} />}>Overview and QR code</DropdownMenuItem>
              <DropdownMenuSeparator />
              {MANAGE_LINKS.map((item) => (
                <DropdownMenuItem key={item.path} render={<Link href={`/dashboard/apps/${app.id}/${item.path}`} />}>
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<a href={previewUrl} target="_blank" rel="noreferrer" />}>Visit app</DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DeleteAppMenuItem appId={app.id} />
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {canDelete && <DeleteAppDialog appId={app.id} appName={app.name} />}
    </article>
  );
}

/** The week's views as a soft white area along the bottom of the cover. */
function Sparkline({ values }: { values: DailyViews }) {
  const w = 300;
  const h = 56;
  const max = Math.max(1, ...values);
  // Inset so the end dot isn't cut off by the card edge.
  const pad = 12;
  const step = (w - 2 * pad) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, h - 6 - (v / max) * (h - 16)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w - pad},${h} L${pad},${h} Z`;
  const [lx, ly] = pts[pts.length - 1] ?? [w, h];
  // The SVG stretches to the card width, so the end dot is HTML to stay round.
  return (
    <div aria-hidden className="absolute inset-x-0 bottom-0 h-14">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        <path d={area} fill="rgba(255,255,255,0.16)" />
        <path d={line} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
        style={{ left: `${(lx / w) * 100}%`, top: `${(ly / h) * 100}%` }}
      />
    </div>
  );
}
