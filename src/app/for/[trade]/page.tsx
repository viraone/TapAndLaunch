import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { LISTED_PRICE, jsonLdText, pageMetadata, structuredData } from "@/lib/marketing";
import { TRADE_PAGES, tradeBySlug } from "@/lib/marketing/trades";
import { buildStarter } from "@/lib/apps/templates";
import { fontsHref } from "@/lib/pwa/theme-style";
import { SiteFrame } from "@/components/dashboard/SiteFrame";
import { CTA_BUTTON, MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";

type Params = Promise<{ trade: string }>;

export function generateStaticParams() {
  return TRADE_PAGES.map((t) => ({ trade: t.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = tradeBySlug((await params).trade);
  if (!page) return {};
  return pageMetadata({ title: page.title, description: page.description, path: `/for/${page.slug}` });
}

/** The page for one trade: the headline in their words, the real template on a laptop and a phone, what it includes. */
export default async function TradePage({ params }: { params: Params }) {
  const page = tradeBySlug((await params).trade);
  if (!page) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;
  const startHref = signedIn ? `/dashboard/apps/new?template=${page.topic.id}` : "/signup";
  const fonts = fontsHref(buildStarter(page.topic.id, "x").theme);
  const others = TRADE_PAGES.filter((t) => t.slug !== page.slug);

  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-neutral-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(structuredData(["software"])) }} />
      {fonts && <link rel="stylesheet" href={fonts} />}
      <MarketingHeader signedIn={signedIn} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 pb-24 sm:px-10">
        <nav aria-label="Breadcrumb" className="pt-6 text-sm text-neutral-500">
          <Link href="/for" className="underline-offset-4 hover:text-neutral-950 hover:underline">
            Websites by trade
          </Link>
          <span aria-hidden> / </span>
          <span className="text-neutral-950">{page.topic.name}</span>
        </nav>
        <section className="grid gap-8 pb-14 pt-8 sm:pt-12 lg:grid-cols-2 lg:items-end lg:gap-16">
          <div>
            <p className="bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-xs font-semibold uppercase tracking-[0.2em] text-transparent">
              For {page.people} · Free for {TRIAL_DAYS} days · No code
            </p>
            <h1 className="mt-4 text-balance text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl">{page.headline}</h1>
          </div>
          <div className="max-w-xl">
            <p className="text-lg leading-relaxed text-neutral-700">{page.topic.tagline} Pick one of {page.designCount} designs, write a sentence about what you do, and change every word after.</p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link href={startHref} className={`group ${CTA_BUTTON}`}>
                {signedIn ? "Start with this template" : "Start your free trial"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/pricing" className="inline-flex min-h-12 items-center rounded-full px-4 text-sm font-medium text-neutral-600 transition hover:text-neutral-950">
                ${LISTED_PRICE.dollarsPerMonth} a month after the trial
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="preview" className="border-t border-neutral-200 pt-6">
          <h2 id="preview" className="text-base font-medium">
            The {page.topic.name} starting point, on a laptop and a phone
          </h2>
          <Link href={startHref} className="group mt-8 block max-w-4xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950">
            <SiteFrame template={page.template} />
          </Link>
          <p className="mt-4 max-w-2xl text-sm text-neutral-500">Drawn by the same code that builds your site, so what you see is what you get. It comes filled in with sample words for a {page.topic.eyebrow.toLowerCase()}; you replace them with yours.</p>
        </section>

        <section aria-labelledby="includes" className="mt-24 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="includes" className="text-balance text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-5xl">
              What it includes
            </h2>
            <ul className="mt-8 grid gap-3 text-neutral-700">
              {page.includes.map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /> {line[0].toUpperCase() + line.slice(1)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-balance text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-5xl">How it works</h2>
            <ol className="mt-8 space-y-4 text-neutral-700">
              <li>
                <span className="font-medium text-neutral-950">1. Choose this starting point.</span> Tick what you need, like a gallery or bookings, and pick one of {page.designCount} designs.
              </li>
              <li>
                <span className="font-medium text-neutral-950">2. Say what you do.</span> One sentence is enough to make the first draft yours.
              </li>
              <li>
                <span className="font-medium text-neutral-950">3. Publish.</span> Your site goes to its own web address. Connect a domain you already own when you are ready.
              </li>
            </ol>
            <p className="mt-6 text-sm text-neutral-500">
              Every site also installs on a phone from a link or QR code, can take card payments through your own Stripe account, and can send push notifications to the people who install it.
            </p>
          </div>
        </section>

        <section aria-labelledby="other-trades" className="mt-24 border-t border-neutral-200 pt-6">
          <h2 id="other-trades" className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Other trades
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((t) => (
              <li key={t.slug}>
                <Link href={`/for/${t.slug}`} className="inline-block rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-200 hover:text-neutral-950">
                  {t.topic.name}
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
