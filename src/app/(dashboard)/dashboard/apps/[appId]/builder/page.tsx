import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuilderClient } from "@/components/builder/BuilderClient";
import { AiChatPanel } from "@/components/builder/AiChatPanel";
import { CodeBuilder } from "@/components/builder/CodeBuilder";
import { latestVersion, listVersions } from "@/lib/code/store";
import { getRootDomain, rootDomainFor } from "@/lib/tenant";
import { appHasVisit } from "@/lib/apps/signals";
import { isVercelDomainsConfigured } from "@/lib/domains/vercel";

// See the note in `published-apps/[appSlug]/layout.tsx` on why `params` is typed by
// hand instead of via the generated `PageProps<...>` helper.
type Params = Promise<{ appId: string }>;

export default async function BuilderPage({ params, searchParams }: { params: Params; searchParams: Promise<{ ai?: string }> }) {
  const { appId } = await params;
  const { ai } = await searchParams;
  const supabase = await createClient();

  // RLS (`is_org_member`) is what actually enforces "this user may view this
  // app" — a `.maybeSingle()` that comes back empty here means either the
  // app doesn't exist or the user isn't a member of its org, and both cases
  // should look identical (404), not leak which one it was.
  const { data: app } = await supabase.from("apps").select("*").eq("id", appId).maybeSingle();
  if (!app) notFound();

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
  const [hasVisit, otherBlocks] = await Promise.all([
    app.status === "published" ? appHasVisit(supabase, appId) : Promise.resolve(false),
    otherPageIds.length ? supabase.from("blocks").select("id").in("page_id", otherPageIds).limit(1) : Promise.resolve({ data: [] }),
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
    />
    <AiChatPanel appId={appId} appName={app.name} initiallyOpen={ai === "1"} />
    </>
  );
}
