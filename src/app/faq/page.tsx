import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { jsonLdText, pageMetadata, structuredData } from "@/lib/marketing";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { FaqSection, WhoItsForSection } from "@/components/marketing/Sections";

export const metadata: Metadata = pageMetadata({
  title: "Questions and answers | TapAndLaunch",
  description: "Answers about TapAndLaunch: what a progressive web app is, whether you need to code, custom domains, taking card payments, push notifications and the price.",
  path: "/faq",
});

export default async function FaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-neutral-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(structuredData(["faq"])) }} />
      <MarketingHeader signedIn={!!user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 pb-24 sm:px-10">
        <FaqSection level="h1" className="mt-10 sm:mt-16" />
        <WhoItsForSection className="mt-24" />
      </main>
      <MarketingFooter />
    </div>
  );
}
