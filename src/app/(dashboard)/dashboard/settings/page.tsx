import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { OrgSettingsForm } from "./OrgSettingsForm";
import { PaymentsCard } from "./PaymentsCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeAccountRow, syncStripeAccount } from "@/lib/stripe/accounts";
import { isStripeConfigured, isStripeTestMode } from "@/lib/stripe/server";

export default async function OrgSettingsPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const { stripe: stripeReturn } = await searchParams;
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
    // Back from Stripe's setup pages: ask Stripe for the latest, so this page is right before any webhook arrives.
    if (stripeAccount && stripeReturn) {
      try {
        stripeAccount = (await syncStripeAccount(admin, organizationId, stripeAccount.stripe_account_id)) ?? stripeAccount;
      } catch (error) {
        console.error("stripe sync failed:", error instanceof Error ? error.message : error);
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-6">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
        </CardHeader>
        <CardContent>
          {activeMembership?.role === "admin" ? (
            <OrgSettingsForm organization={organization} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Only an organization admin can change these settings. You&rsquo;re a{" "}
              <strong>{activeMembership?.role}</strong> here.
            </p>
          )}
        </CardContent>
      </Card>
      {showPayments && <PaymentsCard account={stripeAccount} testMode={isStripeTestMode()} />}
    </main>
  );
}
