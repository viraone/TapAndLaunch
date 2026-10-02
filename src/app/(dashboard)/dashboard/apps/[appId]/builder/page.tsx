import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuilderClient } from "@/components/builder/BuilderClient";
import { getRootDomain } from "@/lib/tenant";
import { appHasVisit } from "@/lib/apps/signals";

// See the note in `published-apps/[appSlug]/layout.tsx` on why `params` is typed by
// hand instead of via the generated `PageProps<...>` helper.
type Params = Promise<{ appId: string }>;

export default async function BuilderPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  // RLS (`is_org_member`) is what actually enforces "this user may view this
  // app" — a `.maybeSingle()` that comes back empty here means either the
  // app doesn't exist or the user isn't a member of its org, and both cases
  // should look identical (404), not leak which one it was.
  const { data: app } = await supabase.from("apps").select("*").eq("id", appId).maybeSingle();
  if (!app) notFound();

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

  return (
    <BuilderClient
      app={app}
      rootDomain={getRootDomain()}
      initialPages={pages}
      initialPageId={homePage.id}
      initialBlocks={blocks ?? []}
      mapsEnabled={org?.maps_enabled === true}
      hasVisit={hasVisit}
      contentOnOtherPages={!!otherBlocks.data?.length}
    />
  );
}
