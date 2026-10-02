import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { NewAppForm } from "./NewAppForm";

export default async function NewAppPage() {
  const supabase = await createClient();

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  if (!organizationId) redirect("/onboarding");

  return (
    <main className="flex-1 bg-neutral-100/70">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">New app</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">What are you building?</h1>
          <p className="mt-2 max-w-lg text-sm text-neutral-400">
            Pick a starting point. It comes filled in, so you can preview it right away and change anything.
          </p>
        </div>
      </section>
      <div className="relative mx-auto -mt-10 w-full max-w-6xl px-6 pb-16">
        <NewAppForm organizationId={organizationId} rootDomain={getRootDomain()} />
      </div>
    </main>
  );
}
