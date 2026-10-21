import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { NewAppForm } from "./NewAppForm";
import { FirstRunSteps, FlowProgressProvider } from "./FlowProgress";

export default async function NewAppPage({ searchParams }: { searchParams: Promise<{ welcome?: string; template?: string; domain?: string }> }) {
  const { welcome, template, domain: domainOrderId } = await searchParams;
  const firstRun = welcome === "1";
  const supabase = await createClient();

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  if (!organizationId) redirect("/onboarding");

  const [{ data: org }, { data: domainOrder }] = await Promise.all([
    supabase.from("organizations").select("maps_enabled").eq("id", organizationId).maybeSingle(),
    // "Build the site for costumecontestsseattle.com": the domain bought here that this new site is for (RLS: the
    // organization's own orders only), connected to the site the moment it is created.
    domainOrderId
      ? supabase.from("domain_orders").select("id, domain").eq("id", domainOrderId).eq("organization_id", organizationId).eq("status", "registered").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <main className="flex-1 bg-white">
      <FlowProgressProvider>
      <section className="mx-auto grid w-full max-w-[1400px] gap-8 px-6 pb-10 pt-12 sm:px-10 sm:pt-16 lg:grid-cols-2 lg:items-end lg:gap-16">
        <div>
          <p className="bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-xs font-semibold uppercase tracking-[0.2em] text-transparent">{firstRun ? "Welcome to TapAndLaunch" : "New app"}</p>
          <h1 className="mt-3 text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-neutral-950 sm:text-7xl">What are you building?</h1>
        </div>
        <div className="max-w-xl">
          <p className="text-lg leading-relaxed text-neutral-700">
            {domainOrder
              ? `This is the site for ${domainOrder.domain}: it gets that address the moment it's created. Pick a starting point; it comes filled in, and you can change anything.`
              : firstRun
                ? "Let's get your first app live. Pick a starting point. You'll have something to preview in under a minute, and you can change all of it."
                : "Pick a starting point. It comes filled in, so you can preview it right away and change anything."}
          </p>
          {firstRun && <FirstRunSteps />}
        </div>
      </section>
      <div className="relative mx-auto w-full max-w-[1400px] px-6 pb-20 sm:px-10">
        <NewAppForm organizationId={organizationId} rootDomain={getRootDomain()} mapsEnabled={org?.maps_enabled === true} initialTemplateId={template} domainOrder={domainOrder ?? null} />
      </div>
      </FlowProgressProvider>
    </main>
  );
}
