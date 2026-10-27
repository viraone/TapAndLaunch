import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/marketing";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { SiteCheck } from "./SiteCheck";

export const metadata: Metadata = pageMetadata({
  title: "Check your website | TapAndLaunch",
  description: "Check your website for free: a polite, read-only crawl of up to 15 pages that shows what Google sees and how each page scores.",
  path: "/site-check",
});

/** The public "check my site" page: type a site and watch a polite, read-only audit stream back live. */
export default async function SiteCheckPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-neutral-950">
      <MarketingHeader signedIn={!!user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 pb-24 sm:px-10">
        <section className="pt-10 sm:pt-16">
          <p className="bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-xs font-semibold uppercase tracking-[0.2em] text-transparent">
            Free website check
          </p>
          <h1 className="mt-4 max-w-4xl text-balance text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl lg:text-8xl">See what Google sees.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-700">
            Type a site and watch a polite, read-only crawl of up to 15 pages — what&rsquo;s there, what&rsquo;s broken, and how each page scores. Free, and
            done in about a minute.
          </p>
        </section>

        <SiteCheck initialUrl={q ?? ""} />
      </main>
      <MarketingFooter />
    </div>
  );
}
