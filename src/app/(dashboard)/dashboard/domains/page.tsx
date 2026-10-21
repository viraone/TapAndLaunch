import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { cancelDomainOrder, fulfillDomainOrder } from "@/lib/domains/purchase";
import type { DomainOrderStatus } from "@/types/database";
import { DomainsList } from "./DomainsList";

export const dynamic = "force-dynamic";

/**
 * Dashboard > Domains: every domain the organization bought here, which site each one is connected to, and a way to
 * connect the ones that aren't. Stripe sends a buyer back here after paying on tapandlaunch.com/domains, with
 * `?domain=success&order=…`: the purchase is finished before the page renders, so the new domain shows at once.
 */
export default async function DomainsPage({ searchParams }: { searchParams: Promise<{ domain?: string; order?: string }> }) {
  const { domain: domainReturnKind, order: orderId } = await searchParams;
  const supabase = await createClient();
  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  if (!organizationId) redirect("/onboarding");

  let domainReturn: DomainOrderStatus | null = null;
  if ((domainReturnKind === "success" || domainReturnKind === "cancelled") && orderId) {
    // RLS: members only see their own organization's orders, so a stranger's order id does nothing here.
    const { data: known } = await supabase.from("domain_orders").select("id").eq("id", orderId).eq("organization_id", organizationId).maybeSingle();
    if (known) {
      try {
        const admin = createAdminClient();
        const row = domainReturnKind === "success" ? await fulfillDomainOrder(admin, orderId) : await cancelDomainOrder(admin, orderId);
        domainReturn = row?.status ?? null;
      } catch (error) {
        console.error("domain purchase fulfilment failed:", error instanceof Error ? error.message : error);
        domainReturn = "pending";
      }
    }
  }

  const [{ data: orders }, { data: apps }] = await Promise.all([
    supabase.from("domain_orders").select("*").eq("organization_id", organizationId).neq("status", "cancelled").order("created_at", { ascending: false }),
    supabase.from("apps").select("id, name, slug, custom_domain").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);
  const role = memberships.find((m) => m.organization_id === organizationId)?.role;

  return (
    <main className="flex-1 bg-white">
      <section className="mx-auto grid w-full max-w-[1400px] gap-8 px-6 pb-10 pt-12 sm:px-10 sm:pt-16 lg:grid-cols-2 lg:items-end lg:gap-16">
        <div className="min-w-0">
          <h1 className="text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl">Your domains</h1>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6 lg:justify-end lg:gap-10">
          <p className="max-w-sm text-lg leading-relaxed text-neutral-700">
            {orders?.length ? "The addresses you own here, and which site each one points at." : "Own your address. Search a name, pay the registrar's price, connect it to any site you build here."}
          </p>
          <Link href="/domains" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white transition hover:bg-neutral-800">
            Find a domain <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      <section className="mx-auto w-full max-w-[1400px] px-6 pb-24 sm:px-10">
        <DomainsList orders={orders ?? []} apps={apps ?? []} canEdit={role === "admin" || role === "creator"} domainReturn={domainReturn} />
      </section>
    </main>
  );
}
