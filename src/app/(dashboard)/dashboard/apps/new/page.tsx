import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { NewAppForm } from "./NewAppForm";

export default async function NewAppPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const firstRun = welcome === "1";
  const supabase = await createClient();

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  if (!organizationId) redirect("/onboarding");

  const { data: org } = await supabase.from("organizations").select("maps_enabled").eq("id", organizationId).maybeSingle();

  return (
    <main className="flex-1 bg-white">
      <section className="mx-auto grid w-full max-w-[1400px] gap-8 px-6 pb-10 pt-12 sm:px-10 sm:pt-16 lg:grid-cols-2 lg:items-end lg:gap-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{firstRun ? "Welcome to TapAndLaunch" : "New app"}</p>
          <h1 className="mt-3 text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-neutral-950 sm:text-7xl">What are you building?</h1>
        </div>
        <div className="max-w-xl">
          <p className="text-lg leading-relaxed text-neutral-700">
            {firstRun
              ? "Let's get your first app live. Pick a starting point. You'll have something to preview in under a minute, and you can change all of it."
              : "Pick a starting point. It comes filled in, so you can preview it right away and change anything."}
          </p>
          {firstRun && (
            <ol className="mt-6 flex flex-wrap gap-2 text-xs font-medium" aria-label="Your first app, in four steps">
              {["Choose a start", "Name it", "Make it yours", "Publish and share"].map((label, i) => (
                <li
                  key={label}
                  aria-current={i === 0 ? "step" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 ${i === 0 ? "bg-neutral-950 text-white ring-neutral-950" : "bg-white text-neutral-600 ring-neutral-200"}`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-white text-neutral-950" : "bg-neutral-100 text-neutral-600"}`}>{i + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
      <div className="relative mx-auto w-full max-w-[1400px] px-6 pb-20 sm:px-10">
        <NewAppForm organizationId={organizationId} rootDomain={getRootDomain()} mapsEnabled={org?.maps_enabled === true} />
      </div>
    </main>
  );
}
