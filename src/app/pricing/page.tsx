import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { LISTED_PRICE, jsonLdText, pageMetadata, structuredData } from "@/lib/marketing";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { PricingSection, WhoItsForSection } from "@/components/marketing/Sections";

export const metadata: Metadata = pageMetadata({
  title: `Pricing: $${LISTED_PRICE.dollarsPerMonth} a month, ${TRIAL_DAYS} days free | TapAndLaunch`,
  description: `One plan for everything: $${LISTED_PRICE.dollarsPerMonth} a month or $${LISTED_PRICE.dollarsPerYear} a year, after a ${TRIAL_DAYS}-day free trial with no card needed. No feature locks. Cancel any time.`,
  path: "/pricing",
});

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;

  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-neutral-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(structuredData(["software"])) }} />
      <MarketingHeader signedIn={signedIn} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 pb-24 sm:px-10">
        <PricingSection signedIn={signedIn} level="h1" className="mt-10 sm:mt-16" />
        <WhoItsForSection className="mt-24" />
      </main>
      <MarketingFooter />
    </div>
  );
}
