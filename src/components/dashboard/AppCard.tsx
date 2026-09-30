import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpRight, ChevronDown, Pencil } from "lucide-react";
import type { Database } from "@/types/database";

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

/** A stable gradient per app so the grid reads as distinct tiles even
 * before an icon is uploaded. */
const TILE_GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-pink-500 to-rose-500",
  "from-emerald-500 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
];
function tileGradient(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_GRADIENTS[h % TILE_GRADIENTS.length];
}

export function AppCard({ app, rootDomain }: { app: AppRow; rootDomain: string }) {
  const previewUrl = `//${app.slug}.${rootDomain}`;
  const published = app.status === "published";
  const iconUrl = app.manifest.icon_url;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start gap-3 p-4">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
          <img src={iconUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-md" />
        ) : (
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg font-bold text-white shadow-md ${tileGradient(app.id)}`}
          >
            {app.name.trim().charAt(0).toUpperCase() || "A"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold tracking-tight">{app.name}</h2>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                published ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/30" : "bg-muted text-muted-foreground ring-1 ring-inset ring-border"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-emerald-500" : "bg-neutral-400"}`} />
              {published ? "Live" : "Draft"}
            </span>
          </div>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground transition hover:text-foreground"
          >
            <span className="truncate">{app.slug}.{rootDomain}</span>
            <ArrowUpRight className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t bg-muted/30 px-3 py-2.5">
        <Link
          href={`/dashboard/apps/${app.id}/builder`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
        >
          <Pencil className="h-3.5 w-3.5" /> Open builder
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted">
            Manage <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MANAGE_LINKS.map((item) => (
              <DropdownMenuItem key={item.path} render={<Link href={`/dashboard/apps/${app.id}/${item.path}`} />}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
