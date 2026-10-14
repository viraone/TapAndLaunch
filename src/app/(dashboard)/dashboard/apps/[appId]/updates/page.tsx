import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { appLiveUrl } from "@/lib/apps/share";
import { QuickUpdates } from "./QuickUpdates";
import type { GalleryBlockConfig } from "@/types/database";

type Params = Promise<{ appId: string }>;

/**
 * Quick updates: the three things the owner of a live app does week to week (add a show, add photos, read messages)
 * on one page with nothing else on it. The full builder is one tap away for changing the design. Built for clients
 * who are not building the app, just running it.
 */
export default async function QuickUpdatesPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name, slug, status, kind, organization_id, custom_domain, custom_domain_status").eq("id", appId).maybeSingle();
  if (!app || app.kind === "code") notFound();

  // Shows from a few hours ago onwards: tonight's show stays listed while it is on.
  const since = new Date();
  since.setHours(since.getHours() - 6);
  const [{ data: events }, { data: submissions }, { data: pages }] = await Promise.all([
    supabase.from("events").select("*").eq("app_id", appId).gte("starts_at", since.toISOString()).order("starts_at", { ascending: true }).limit(50),
    supabase.from("form_submissions").select("*").eq("app_id", appId).order("created_at", { ascending: false }).limit(5),
    supabase.from("pages").select("id, is_home, position").eq("app_id", appId).order("position"),
  ]);

  // The gallery the Add photos card fills: the first Photo gallery block, the home page's first.
  const orderedPages = [...(pages ?? [])].sort((a, b) => Number(b.is_home) - Number(a.is_home));
  let photos: Array<{ src: string; alt?: string }> = [];
  if (orderedPages.length) {
    const { data: blocks } = await supabase.from("blocks").select("page_id, position, config").in("page_id", orderedPages.map((p) => p.id)).eq("type", "gallery").order("position");
    const rank = new Map(orderedPages.map((p, i) => [p.id, i]));
    const first = (blocks ?? []).sort((a, b) => (rank.get(a.page_id) ?? 0) - (rank.get(b.page_id) ?? 0) || a.position - b.position)[0];
    photos = ((first?.config as GalleryBlockConfig | undefined)?.images ?? []).filter((i) => i.src);
  }

  const published = app.status === "published";
  const liveUrl = appLiveUrl(app, getRootDomain());

  return (
    <main className="flex-1 bg-neutral-100/70">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{app.name}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950">Quick updates</h1>
            <p className="mt-1 text-sm text-neutral-500">Paste a flyer, add a show, add photos, read your messages. Changes are live as soon as you save.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {published && (
              <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-neutral-800 ring-1 ring-black/10 transition hover:bg-neutral-50">
                See the site <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
            <Link href={`/dashboard/apps/${appId}/builder`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-neutral-800 ring-1 ring-black/10 transition hover:bg-neutral-50">
              <Pencil className="h-4 w-4" /> Change the design
            </Link>
          </div>
        </header>

        <QuickUpdates appId={appId} organizationId={app.organization_id} initialEvents={events ?? []} initialPhotos={photos} submissions={submissions ?? []} />

        <p className="text-center text-xs text-neutral-500">
          Everything else (members, notifications, products, analytics) is on the <Link href={`/dashboard/apps/${appId}`} className="underline">app overview</Link>.
        </p>
      </div>
    </main>
  );
}
