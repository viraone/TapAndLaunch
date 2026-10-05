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
    <main className="flex-1 bg-neutral-100/70">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">{firstRun ? "Welcome to TapAndLaunch" : "New app"}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">What are you building?</h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-400">
            {firstRun
              ? "Let's get your first app live. Describe it in a sentence, or pick a starting point. You'll have something to preview in under a minute, and you can change all of it."
              : "Describe it in a sentence, or pick a starting point. It comes filled in, so you can preview it right away and change anything."}
          </p>
          {firstRun && (
            <ol className="mt-6 flex flex-wrap gap-2 text-xs font-medium" aria-label="Your first app, in four steps">
              {["Choose a start", "Name it", "Make it yours", "Publish and share"].map((label, i) => (
                <li
                  key={label}
                  aria-current={i === 0 ? "step" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 ${i === 0 ? "bg-white text-neutral-950 ring-white" : "bg-white/5 text-neutral-300 ring-white/15"}`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-neutral-950 text-white" : "bg-white/15 text-neutral-200"}`}>{i + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
      <div className="relative mx-auto -mt-10 w-full max-w-6xl px-6 pb-16">
        <NewAppForm organizationId={organizationId} rootDomain={getRootDomain()} mapsEnabled={org?.maps_enabled === true} />
      </div>
    </main>
  );
}
