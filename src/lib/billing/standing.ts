import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingState, isBillingEnforced, isInGoodStanding } from "./plans";

/**
 * Whether an organization's published apps may be served. Always true unless `BILLING_ENFORCED=true`, so
 * having plans in the dashboard changes nothing for visitors until that switch is flipped on purpose.
 * A failed payment's grace period is counted from the billing row's last change, which is when it became past due.
 */
export const orgInGoodStanding = cache(async (organizationId: string): Promise<boolean> => {
  if (!isBillingEnforced()) return true;
  const { data } = await createAdminClient().from("org_billing").select("*").eq("organization_id", organizationId).maybeSingle();
  const now = new Date();
  return isInGoodStanding(billingState(data, now), now, data ? new Date(data.updated_at) : null);
});
