import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { jsonLdText, pageMetadata, structuredData } from "@/lib/marketing";
import { TRADES_INDEX, TRADE_PAGES } from "@/lib/marketing/trades";
import { buildStarter } from "@/lib/apps/templates";
import { fontsHref } from "@/lib/pwa/theme-style";
import { LateFonts } from "@/components/marketing/LateFonts";
import { SiteFrame } from "@/components/dashboard/SiteFrame";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = pageMetadata({ title: TRADES_INDEX.title, description: TRADES_INDEX.description, path: "/for" });

const FONTS = Array.from(new Set(TRADE_PAGES.map((t) => fontsHref(buildStarter(t.topic.id, "x").theme)).filter((h): h is string => !!h)));

/** Every trade with its starting point, one card each, the way the picker shows them. */
export default async function TradesIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-neutral-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(structuredData(["software"])) }} />
      <LateFonts hrefs={FONTS} />
      <MarketingHeader signedIn={!!user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 pb-24 sm:px-10">
        <section className="grid gap-8 pb-14 pt-10 sm:pt-16 lg:grid-cols-2 lg:items-end lg:gap-16">
          <div>
            <p className="bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-xs font-semibold uppercase tracking-[0.2em] text-transparent">
              {TRADE_PAGES.length} starting points · Free for {TRIAL_DAYS} days · No code
            </p>
            <h1 className="mt-4 text-balance text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl">A website for your trade</h1>
          </div>
          <p className="max-w-xl text-lg leading-relaxed text-neutral-700">
            Each one comes filled in for the work you do, in {TRADE_PAGES[0].designCount} designs, with the sections that trade needs. Pick yours, say what you do, and change anything after.
          </p>
        </section>
        <section aria-labelledby="trades" className="border-t border-neutral-200 pt-6">
          <h2 id="trades" className="text-base font-medium">
            Who is it for?
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {TRADE_PAGES.map((t) => (
              <li key={t.slug}>
                <Link href={`/for/${t.slug}`} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950">
                  <SiteFrame template={t.template} />
                  <p className="mt-3.5 text-[17px] font-medium tracking-tight">{t.topic.name}</p>
                  <p className="mt-1 text-sm text-neutral-500">For {t.people}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
