import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildChecklist, type Checklist } from "@/lib/apps/checklist";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];

/**
 * The "Get live" checklist for each app, from the app's own data. Two small
 * lookups: which apps have any block on any page, and which have had a visit.
 * (RLS limits both to the signed-in customer's organization.)
 */
export async function getChecklists(supabase: SupabaseClient<Database>, apps: AppRow[]): Promise<Map<string, Checklist>> {
  const result = new Map<string, Checklist>();
  if (!apps.length) return result;
  const ids = apps.map((a) => a.id);

  const { data: pages } = await supabase.from("pages").select("id, app_id").in("app_id", ids);
  const appByPage = new Map((pages ?? []).map((p) => [p.id, p.app_id]));
  const withContent = new Set<string>();
  if (appByPage.size) {
    const { data: blocks } = await supabase.from("blocks").select("page_id").in("page_id", [...appByPage.keys()]).limit(5000);
    for (const b of blocks ?? []) {
      const appId = appByPage.get(b.page_id);
      if (appId) withContent.add(appId);
    }
  }

  const visited = new Set<string>();
  await Promise.all(
    apps
      .filter((a) => a.status === "published")
      .map(async (a) => {
        const { data } = await supabase.from("analytics_events").select("id").eq("app_id", a.id).eq("event_type", "view").limit(1);
        if (data?.length) visited.add(a.id);
      })
  );

  for (const app of apps) {
    result.set(
      app.id,
      buildChecklist({
        hasContent: withContent.has(app.id),
        hasIcon: !!app.manifest.icon_url,
        hasLook: !!app.theme.looks_confirmed,
        published: app.status === "published",
        hasVisit: visited.has(app.id),
      })
    );
  }
  return result;
}

/** Has anyone opened this app's published address? */
export async function appHasVisit(supabase: SupabaseClient<Database>, appId: string): Promise<boolean> {
  const { data } = await supabase.from("analytics_events").select("id").eq("app_id", appId).eq("event_type", "view").limit(1);
  return !!data?.length;
}
