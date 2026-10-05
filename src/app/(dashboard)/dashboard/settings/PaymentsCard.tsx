import { CheckCircle2, Wallet } from "lucide-react";
import { ConnectStripeButton } from "./ConnectStripeButton";
import { SettingsSection, TestModeTag } from "./SettingsSection";

/** Where the organization stands with Stripe. `account` is null until they've started connecting. */
export function PaymentsCard({
  account,
  testMode,
}: {
  account: { charges_enabled: boolean; details_submitted: boolean } | null;
  testMode: boolean;
}) {
  const ready = account?.charges_enabled === true;
  return (
    <SettingsSection icon={Wallet} title="Payments" description="Let customers pay by card in your apps" tag={testMode ? <TestModeTag /> : null}>
      {ready ? (
        <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 className="h-5 w-5" /> Payments are on
          </p>
          <p className="mt-1 text-sm text-emerald-900/80">
            Customers can pay by card in your apps. The money goes to your Stripe account, and Stripe emails them a receipt. Manage payouts and refunds in your{" "}
            <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="font-medium underline">
              Stripe dashboard
            </a>
            .
          </p>
        </div>
      ) : account?.details_submitted ? (
        <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
          <p className="font-semibold text-indigo-950">Stripe is checking your details</p>
          <p className="mt-1 text-sm text-indigo-950/70">
            You&rsquo;ve sent everything Stripe asked for. This usually takes under a minute, and sometimes longer for a real business.{" "}
            <a href="/dashboard/settings?stripe=return" className="font-medium underline">
              Check again
            </a>
            . Until it&rsquo;s done, customers can only send order requests.
          </p>
        </div>
      ) : account ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="font-semibold text-amber-950">Finish setting up Stripe</p>
            <p className="mt-1 text-sm text-amber-950/70">Stripe still needs a few details before you can take payments. Until then, customers can only send order requests.</p>
          </div>
          <ConnectStripeButton label="Continue setup" />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Connect a Stripe account so customers can pay when they buy a product. Setup takes a few minutes on Stripe&rsquo;s own pages, and the money goes straight to you. Until you connect, customers can only send order requests.
          </p>
          <ConnectStripeButton label="Connect Stripe" askCountry />
        </div>
      )}
    </SettingsSection>
  );
}
