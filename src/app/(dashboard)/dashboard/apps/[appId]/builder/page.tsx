import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuilderClient } from "@/components/builder/BuilderClient";
import { AiChatPanel } from "@/components/builder/AiChatPanel";

const AI_CHAT_ENABLED = false;
import { CodeBuilder } from "@/components/builder/CodeBuilder";
import { latestVersion, listVersions } from "@/lib/code/store";
import { getRootDomain, rootDomainFor } from "@/lib/tenant";
import { appHasVisit } from "@/lib/apps/signals";
import { isVercelDomainsConfigured } from "@/lib/domains/vercel";
import { cancelDomainOrder, fulfillDomainOrder } from "@/lib/domains/purchase";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DomainOrderStatus } from "@/types/database";

// See the note in `published-apps/[appSlug]/layout.tsx` on why `params` is typed by
// hand instead of via the generated `PageProps<...>` helper.
type Params = Promise<{ appId: string }>;

export default async function BuilderPage({ params, searchParams }: { params: Params; searchParams: Promise<{ ai?: string; domain?: string; order?: string }> }) {
  const { appId } = await params;
  const { ai, domain: domainReturnKind, order: orderId } = await searchParams;
  const supabase = await createClient();

  // RLS (`is_org_member`) is what actually enforces "this user may view this
  // app" — a `.maybeSingle()` that comes back empty here means either the
  // app doesn't exist or the user isn't a member of its org, and both cases
  // should look identical (404), not leak which one it was.
  let { data: app } = await supabase.from("apps").select("*").eq("id", appId).maybeSingle();
  if (!app) notFound();

  // Back from paying for a domain (Domain tab -> Stripe): finish the purchase here, so the tab shows the result without
  // waiting for Stripe's webhook, then reload the app row, since the domain was just attached to it. The order has to
  // be one this app's members can see; the fulfilment itself runs with the service role.
  let domainReturn: DomainOrderStatus | null = null;
  if ((domainReturnKind === "success" || domainReturnKind === "cancelled") && orderId) {
    const { data: known } = await supabase.from("domain_orders").select("id").eq("id", orderId).eq("app_id", appId).maybeSingle();
    if (known) {
      try {
        const admin = createAdminClient();
        const row = domainReturnKind === "success" ? await fulfillDomainOrder(admin, orderId) : await cancelDomainOrder(admin, orderId);
        domainReturn = row?.status ?? null;
      } catch (error) {
        console.error("domain purchase fulfilment failed:", error instanceof Error ? error.message : error);
        domainReturn = "pending";
      }
      // Not the same query as the read above: Next memoizes identical GETs within a render and would hand back the
      // app as it was before the domain was attached (the tab then offered "Connect it" for a connected domain).
      const { data: fresh } = await supabase.from("apps").select("*", { count: "exact" }).eq("id", appId).maybeSingle();
      if (fresh) app = fresh;
    }
  }

  // An AI-written (BYOB) app has its own builder: chat on one side, a live sandboxed preview on the other.
  if (app.kind === "code") {
    const [latest, versions] = await Promise.all([latestVersion(supabase, appId), listVersions(supabase, appId)]);
    return (
      <CodeBuilder
        app={app}
        domainsEnabled={isVercelDomainsConfigured()}
        appId={appId}
        appName={app.name}
        accent={app.theme.primary_color}
        slug={app.slug}
        rootDomain={rootDomainFor("code")}
        initialFiles={latest?.files ?? {}}
        initialVersion={latest?.version ?? 0}
        initialVersions={versions}
        initialStatus={app.status}
        initialPublished={app.code_published_version}
        takenDown={app.suspended_at ? app.suspended_reason ?? "" : null}
      />
    );
  }

  const { data: pages } = await supabase
    .from("pages")
    .select("*")
    .eq("app_id", appId)
    .order("position", { ascending: true });

  if (!pages || pages.length === 0) notFound();

  const homePage = pages.find((p) => p.is_home) ?? pages[0];

  const { data: blocks } = await supabase
    .from("blocks")
    .select("*")
    .eq("page_id", homePage.id)
    .order("position", { ascending: true });

  const { data: org } = await supabase.from("organizations").select("maps_enabled").eq("id", app.organization_id).maybeSingle();

  const otherPageIds = pages.filter((p) => p.id !== homePage.id).map((p) => p.id);
  // Upcoming events (from a few hours ago), for "Next up": a show just added that the banner doesn't mention yet,
  // or sample events still on the calendar.
  const since = new Date();
  since.setHours(since.getHours() - 6);
  const [hasVisit, otherBlocks, { data: events }] = await Promise.all([
    app.status === "published" ? appHasVisit(supabase, appId) : Promise.resolve(false),
    otherPageIds.length ? supabase.from("blocks").select("id").in("page_id", otherPageIds).limit(1) : Promise.resolve({ data: [] }),
    supabase.from("events").select("id, title, starts_at, description, created_at").eq("app_id", appId).gte("starts_at", since.toISOString()).order("starts_at", { ascending: true }).limit(30),
  ]);

  // When the AI chat changes the saved app, this value changes and the builder reloads from the new version.
  const allPageIds = pages.map((p) => p.id);
  const [{ data: latestBlock }, { count: blockCount }] = await Promise.all([
    supabase.from("blocks").select("updated_at").in("page_id", allPageIds).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("blocks").select("id", { count: "exact", head: true }).in("page_id", allPageIds),
  ]);
  const version = [app.updated_at, ...pages.map((p) => `${p.id}:${p.updated_at}`), latestBlock?.updated_at ?? "", blockCount ?? 0].join("|");

  return (
    <>
    <BuilderClient
      key={version}
      app={app}
      rootDomain={getRootDomain()}
      initialPages={pages}
      initialPageId={homePage.id}
      initialBlocks={blocks ?? []}
      mapsEnabled={org?.maps_enabled === true}
      domainsEnabled={isVercelDomainsConfigured()}
      hasVisit={hasVisit}
      contentOnOtherPages={!!otherBlocks.data?.length}
      recentEvents={events ?? []}
      domainReturn={domainReturn}
    />
    {/* Build with AI is switched off for now (2026-10-14): one less thing on the screen while the builder is being simplified. */}
    {AI_CHAT_ENABLED && <AiChatPanel appId={appId} appName={app.name} initiallyOpen={ai === "1"} />}
    </>
  );
}
