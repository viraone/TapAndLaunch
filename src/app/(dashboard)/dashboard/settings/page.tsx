import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { OrgSettingsForm } from "./OrgSettingsForm";
import { PaymentsCard } from "./PaymentsCard";
import { BillingCard } from "./BillingCard";
import { AiKeyCard } from "./AiKeyCard";
import { SettingsSection } from "./SettingsSection";
import { tileGradient, tileInitial } from "@/lib/apps/tile";
import { billingState, planChip } from "@/lib/billing/plans";
import { syncOrgSubscription } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeAccountRow, syncStripeAccount } from "@/lib/stripe/accounts";
import { isStripeConfigured, isStripeTestMode } from "@/lib/stripe/server";

export default async function OrgSettingsPage({ searchParams }: { searchParams: Promise<{ stripe?: string; billing?: string }> }) {
  const { stripe: stripeReturn, billing: billingReturn } = await searchParams;
  const supabase = await createClient();

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  if (!organizationId) redirect("/onboarding");

  const activeMembership = memberships.find((m) => m.organization_id === organizationId);

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  if (!organization) redirect("/dashboard");

  // Payments card: admins only, and only when Stripe is switched on for this deployment.
  let stripeAccount = null;
  const showPayments = activeMembership?.role === "admin" && isStripeConfigured();
  if (showPayments) {
    const admin = createAdminClient();
    stripeAccount = await getStripeAccountRow(admin, organizationId);
    // Setup not finished (or just back from Stripe's pages): ask Stripe for the latest, so this page
    // is right without waiting for a webhook.
    if (stripeAccount && (stripeReturn || !stripeAccount.charges_enabled)) {
      try {
        stripeAccount = (await syncStripeAccount(admin, organizationId, stripeAccount.stripe_account_id)) ?? stripeAccount;
      } catch (error) {
        console.error("stripe sync failed:", error instanceof Error ? error.message : error);
      }
    }
  }

  // Back from paying: ask Stripe for the latest, so the plan shows right away instead of waiting for the webhook.
  if (billingReturn === "success" && isStripeConfigured()) {
    try {
      await syncOrgSubscription(createAdminClient(), organizationId);
    } catch (error) {
      console.error("billing sync failed:", error instanceof Error ? error.message : error);
    }
  }
  // Read with the service-role client on purpose: the layout asks the same question with the user's client at the
  // same moment, and Next.js reuses identical GET requests within one render, which would hand back the answer from
  // before the sync above. `organizationId` is one of the signed-in user's own memberships.
  const { data: billingRow } = await createAdminClient().from("org_billing").select("*").eq("organization_id", organizationId).maybeSingle();
  const plan = billingState(billingRow, new Date());

  const isAdmin = activeMembership?.role === "admin";
  const { data: aiKey } = await createAdminClient().from("org_ai_keys").select("provider, key_hint, model").eq("organization_id", organizationId).maybeSingle();
  const paymentsOn = stripeAccount?.charges_enabled === true;
  const tile = tileGradient(organization.id);

  return (
    <main className="flex-1 bg-neutral-100/70">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative mx-auto w-full max-w-3xl px-6 pb-24 pt-8">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All apps
          </Link>
          <div className="mt-2 flex items-center gap-4">
            {organization.branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant-provided/storage URLs
              <img src={organization.branding.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/20" />
            ) : (
              <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-2xl font-bold text-white shadow-lg ${tile.classes}`}>
                {tileInitial(organization.name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Settings</p>
              <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">{organization.name}</h1>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip>{activeMembership?.role === "admin" ? "Admin" : (activeMembership?.role ?? "Member")}</Chip>
            <Chip>{planChip(plan)}</Chip>
            {showPayments && <Chip>{paymentsOn ? "Payments on" : "Payments not set up"}</Chip>}
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-14 w-full max-w-3xl space-y-6 px-4 pb-16 sm:px-6">
        <SettingsSection icon={Building2} title="Organization" description="Your name, logo and brand color">
          {isAdmin ? (
            <OrgSettingsForm organization={organization} />
          ) : (
            <p className="text-sm text-neutral-500">
              Only an organization admin can change these settings. You&rsquo;re a <strong className="text-neutral-800">{activeMembership?.role}</strong> here.
            </p>
          )}
        </SettingsSection>
        <BillingCard state={plan} isAdmin={isAdmin} billingReady={isStripeConfigured()} testMode={isStripeTestMode()} />
        {showPayments && <PaymentsCard account={stripeAccount} testMode={isStripeTestMode()} />}
        <AiKeyCard initialKey={aiKey ? { provider: aiKey.provider, hint: aiKey.key_hint, model: aiKey.model } : null} canManage={isAdmin} />
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-neutral-100 ring-1 ring-white/15 backdrop-blur">{children}</span>;
}
