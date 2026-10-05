import { CheckCircle2, CreditCard } from "lucide-react";
import { LocalTime } from "@/components/dashboard/LocalTime";
import { PLAN, formatPlanPrice, type BillingState } from "@/lib/billing/plans";
import { PlanButtons } from "./PlanButtons";
import { SettingsSection, TestModeTag } from "./SettingsSection";

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
  const bad = state.kind === "trial_expired" || state.kind === "canceled" || state.kind === "past_due";
  const good = state.kind === "complimentary" || state.kind === "active";

  return (
    <SettingsSection icon={CreditCard} title="Plan & billing" description="What you pay TapAndLaunch" tag={testMode ? <TestModeTag /> : null}>
      <div className={`rounded-2xl p-4 ring-1 ${bad ? "bg-red-50 ring-red-200" : good ? "bg-emerald-50 ring-emerald-200" : "bg-indigo-50 ring-indigo-200"}`}>
        {state.kind === "complimentary" && (
          <>
            <p className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="h-5 w-5" /> Free access
            </p>
            <p className="mt-1 text-sm text-emerald-900/80">This organization has free access to everything. There&rsquo;s nothing to pay.</p>
          </>
        )}
        {state.kind === "trial" && (
          <>
            <p className="font-semibold text-indigo-950">
              Free trial: {state.daysLeft} {state.daysLeft === 1 ? "day" : "days"} left
            </p>
            <p className="mt-1 text-sm text-indigo-950/70">Everything is included, no card needed. Choose a plan any time before it ends and you keep the days you have left.</p>
          </>
        )}
        {state.kind === "trial_expired" && (
          <>
            <p className="font-semibold text-red-800">Your free trial has ended</p>
            <p className="mt-1 text-sm text-red-900/80">Choose a plan to keep your apps live.</p>
          </>
        )}
        {state.kind === "canceled" && (
          <>
            <p className="font-semibold text-red-800">Your plan was canceled</p>
            <p className="mt-1 text-sm text-red-900/80">Choose a plan to keep your apps live.</p>
          </>
        )}
        {state.kind === "past_due" && (
          <>
            <p className="font-semibold text-red-800">Your last payment didn&rsquo;t go through</p>
            <p className="mt-1 text-sm text-red-900/80">Update your card so your apps stay live.</p>
          </>
        )}
        {state.kind === "active" && (
          <>
            <p className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="h-5 w-5" /> {PLAN.name} plan{state.interval ? `: ${formatPlanPrice(state.interval)}` : ""}
            </p>
            {state.renewsAt && (
              <p className="mt-1 text-sm text-emerald-900/80">
                {state.cancelsAtPeriodEnd ? "Ends on " : "Next payment on "}
                <LocalTime iso={state.renewsAt} dateOnly />.
              </p>
            )}
          </>
        )}
      </div>

      {state.kind !== "complimentary" && (
        <ul className="mt-5 space-y-2 text-sm text-neutral-600">
          {INCLUDED.map((line) => (
            <li key={line} className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {line}
            </li>
          ))}
        </ul>
      )}

      {(!isAdmin && state.kind !== "complimentary") || (needsPlan && (billingReady || isAdmin)) || (billingReady && isAdmin && (state.kind === "active" || state.kind === "past_due")) ? (
        <div className="mt-6">
          {!isAdmin && state.kind !== "complimentary" && <p className="text-sm text-neutral-500">Only an organization admin can change the plan.</p>}
          {isAdmin && billingReady && needsPlan && <PlanButtons mode="choose" labels={{ year: formatPlanPrice("year"), month: formatPlanPrice("month") }} />}
          {isAdmin && billingReady && (state.kind === "active" || state.kind === "past_due") && <PlanButtons mode="manage" />}
          {isAdmin && !billingReady && needsPlan && <p className="text-sm text-neutral-500">Plans open soon.</p>}
        </div>
      ) : null}
    </SettingsSection>
  );
}
