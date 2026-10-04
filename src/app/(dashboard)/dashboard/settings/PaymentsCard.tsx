import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectStripeButton } from "./ConnectStripeButton";

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
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Payments
          {testMode && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Test mode</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {ready ? (
          <>
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Payments are on
            </p>
            <p className="text-muted-foreground">
              Customers can pay by card in your apps. The money goes to your Stripe account, and Stripe emails them a
              receipt. Manage payouts and refunds in your{" "}
              <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="underline">
                Stripe dashboard
              </a>
              .
            </p>
          </>
        ) : account?.details_submitted ? (
          <>
            <p className="font-medium">Stripe is checking your details</p>
            <p className="text-muted-foreground">
              You&rsquo;ve sent everything Stripe asked for. This usually takes under a minute, and sometimes longer for a
              real business.{" "}
              <a href="/dashboard/settings?stripe=return" className="underline">
                Check again
              </a>
              . Until it&rsquo;s done, customers can only send order requests.
            </p>
          </>
        ) : account ? (
          <>
            <p className="font-medium">Finish setting up Stripe</p>
            <p className="text-muted-foreground">
              Stripe still needs a few details before you can take payments. Until then, customers can only send order
              requests.
            </p>
            <ConnectStripeButton label="Continue setup" />
          </>
        ) : (
          <>
            <p className="font-medium">Take card payments in your apps</p>
            <p className="text-muted-foreground">
              Connect a Stripe account so customers can pay when they buy a product. Setup takes a few minutes on
              Stripe&rsquo;s own pages, and the money goes straight to you. Until you connect, customers can only send
              order requests.
            </p>
            <ConnectStripeButton label="Connect Stripe" askCountry />
          </>
        )}
      </CardContent>
    </Card>
  );
}
