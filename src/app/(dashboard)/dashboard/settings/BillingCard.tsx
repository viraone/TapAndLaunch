import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalTime } from "@/components/dashboard/LocalTime";
import { PLAN, formatPlanPrice, type BillingState } from "@/lib/billing/plans";
import { PlanButtons } from "./PlanButtons";

const INCLUDED = [
  "Your apps on their own web address, hosted and kept up to date",
  "Push notifications and email to your members",
  "Card payments for your store",
  "Member sign-in and members-only content",
  "Analytics, forms, events and bookings",
];

/** What the organization pays TapAndLaunch: where its trial or plan stands, and how to start or manage one. */
export function BillingCard({ state, isAdmin, billingReady, testMode }: { state: BillingState; isAdmin: boolean; billingReady: boolean; testMode: boolean }) {
  const needsPlan = state.kind === "trial" || state.kind === "trial_expired" || state.kind === "canceled";
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Plan &amp; billing
          {testMode && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Test mode</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {state.kind === "complimentary" && (
          <>
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Free access
            </p>
            <p className="text-muted-foreground">This organization has free access to everything. There&rsquo;s nothing to pay.</p>
          </>
        )}

        {state.kind === "trial" && (
          <>
            <p className="font-medium">
              Free trial: {state.daysLeft} {state.daysLeft === 1 ? "day" : "days"} left
            </p>
            <p className="text-muted-foreground">
              Everything is included, no card needed. Choose a plan any time before it ends and you keep the days you have left.
            </p>
          </>
        )}

        {state.kind === "trial_expired" && (
          <>
            <p className="font-medium text-destructive">Your free trial has ended</p>
            <p className="text-muted-foreground">Choose a plan to keep your apps live.</p>
          </>
        )}

        {state.kind === "canceled" && (
          <>
            <p className="font-medium text-destructive">Your plan was canceled</p>
            <p className="text-muted-foreground">Choose a plan to keep your apps live.</p>
          </>
        )}

        {state.kind === "past_due" && (
          <>
            <p className="font-medium text-destructive">Your last payment didn&rsquo;t go through</p>
            <p className="text-muted-foreground">Update your card so your apps stay live.</p>
          </>
        )}

        {state.kind === "active" && (
          <>
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {PLAN.name} plan{state.interval ? `: ${formatPlanPrice(state.interval)}` : ""}
            </p>
            {state.renewsAt && (
              <p className="text-muted-foreground">
                {state.cancelsAtPeriodEnd ? "Ends on " : "Renews on "}
                <LocalTime iso={state.renewsAt} dateOnly />.
              </p>
            )}
          </>
        )}

        {state.kind !== "complimentary" && (
          <ul className="space-y-1 text-muted-foreground">
            {INCLUDED.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>✓</span>
                {line}
              </li>
            ))}
          </ul>
        )}

        {!isAdmin && state.kind !== "complimentary" && <p className="text-muted-foreground">Only an organization admin can change the plan.</p>}

        {isAdmin && billingReady && needsPlan && <PlanButtons mode="choose" labels={{ year: formatPlanPrice("year"), month: formatPlanPrice("month") }} />}
        {isAdmin && billingReady && (state.kind === "active" || state.kind === "past_due") && <PlanButtons mode="manage" />}
        {isAdmin && !billingReady && needsPlan && <p className="text-muted-foreground">Plans open soon.</p>}
      </CardContent>
    </Card>
  );
}
