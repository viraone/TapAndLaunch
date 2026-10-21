import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/marketing";
import { canBuyDomains } from "@/lib/domains/purchase";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { DomainSearch } from "./DomainSearch";

export const metadata: Metadata = pageMetadata({
  title: "Find your domain | TapAndLaunch",
  description: "Search for a .com, .net or .org, buy it at the registrar's price with nothing added, and connect it to your TapAndLaunch site in one click.",
  path: "/domains",
});

const POINTS = [
  { title: "The registrar's price, nothing on top", body: "You pay what the registrar charges for the year, and see it before you pay. Renewal is the same deal." },
  { title: "Yours, privately", body: "Registered for you with privacy on, so your name and address don't go in the public record." },
  { title: "Connected in one click", body: "Point it at any site you build here from your dashboard. No DNS records to copy, no waiting on support." },
];

/** The public domain search: like a registrar's front page, with the buying done by TapAndLaunch. */
export default async function DomainsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
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
            .com · .net · .org
          </p>
          <h1 className="mt-4 max-w-4xl text-balance text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl lg:text-8xl">Find your domain.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-700">
            Type the name you want. We check what&rsquo;s free, show the registrar&rsquo;s price, and after you pay the domain is yours and ready to
            connect to your TapAndLaunch site.
          </p>
        </section>

        <DomainSearch initialQuery={q ?? ""} signedIn={!!user} available={canBuyDomains()} />

        <section aria-labelledby="why" className="mt-24">
          <h2 id="why" className="sr-only">
            How buying a domain here works
          </h2>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-3">
            {POINTS.map(({ title, body }) => (
              <li key={title} className="border-t border-neutral-950 pt-4">
                <h3 className="text-lg font-medium tracking-tight">{title}</h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
