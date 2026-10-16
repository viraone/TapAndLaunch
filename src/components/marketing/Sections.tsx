import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { FAQ, LISTED_PRICE, WHO_FOR } from "@/lib/marketing";
import { CTA_BUTTON } from "@/components/marketing/MarketingChrome";

const BIG_HEADING = "text-balance text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl";

/** On the home page these sections sit under the page's one h1, so they are h2s; on their own page the heading is the h1. */
type Level = "h1" | "h2";

/**
 * "Who it's for": plain text, rendered on the server, that says the business types, the size and the region, and who
 * the product is not for. The words live in `WHO_FOR` (lib/marketing.ts) so a test can hold them to the facts.
 */
export function WhoItsForSection({ className = "" }: { className?: string }) {
  const facts = [WHO_FOR.types, WHO_FOR.size, WHO_FOR.region];
  return (
    <section id="who-its-for" aria-labelledby="who-its-for-title" className={`scroll-mt-8 border-t border-neutral-200 pt-6 ${className}`}>
      <h2 id="who-its-for-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {WHO_FOR.heading}
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-3">
        {facts.map(({ label, text }) => (
          <div key={label} className="border-t border-neutral-950 pt-4">
            <h3 className="text-lg font-medium tracking-tight">{label}</h3>
            <p className="mt-2 leading-relaxed text-neutral-600">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 max-w-3xl">
        <h3 className="text-lg font-medium tracking-tight">{WHO_FOR.notFor.label}</h3>
        <p className="mt-2 leading-relaxed text-neutral-600">{WHO_FOR.notFor.text}</p>
      </div>
    </section>
  );
}

export function PricingSection({ signedIn, level = "h2", className = "mt-24" }: { signedIn: boolean; level?: Level; className?: string }) {
  const Heading = level;
  return (
    <section id="pricing" aria-labelledby="pricing-title" className={`scroll-mt-8 ${className}`}>
      <Heading id="pricing-title" className={BIG_HEADING}>
        One simple plan
      </Heading>
      <div className="mt-12 rounded-3xl bg-neutral-100 p-8 sm:p-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-neutral-500">{LISTED_PRICE.name}</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-6xl font-medium tracking-[-0.04em]">${LISTED_PRICE.dollarsPerMonth}</span>
              <span className="text-neutral-500">/month</span>
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              or ${LISTED_PRICE.dollarsPerYear}/year, save ${LISTED_PRICE.dollarsSavedPerYear}
            </p>
            <p className="mt-3 max-w-sm leading-relaxed text-neutral-700">{LISTED_PRICE.pitch}</p>
          </div>
          <Link href={signedIn ? "/dashboard/settings" : "/signup"} className={CTA_BUTTON}>
            {signedIn ? "Choose a plan" : `Start ${TRIAL_DAYS} days free`}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="mt-8 grid gap-3 border-t border-neutral-300 pt-6 text-neutral-700 sm:grid-cols-2">
          {["Build apps by chatting, with your own Claude or ChatGPT key", `${TRIAL_DAYS}-day free trial, no card needed`, "Your apps on their own web address", "Push notifications and email", "Card payments through your Stripe account", "Cancel any time"].map((line) => (
            <li key={line} className="flex gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FaqSection({ level = "h2", className = "mt-24" }: { level?: Level; className?: string }) {
  const Heading = level;
  return (
    <section id="faq" aria-labelledby="faq-title" className={`scroll-mt-8 ${className}`}>
      <Heading id="faq-title" className={BIG_HEADING}>
        Questions, answered
      </Heading>
      <div className="mt-12 divide-y divide-neutral-200 border-y border-neutral-200">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group py-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium tracking-tight marker:content-none">
              {q}
              <span aria-hidden className="text-2xl text-neutral-400 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 max-w-3xl leading-relaxed text-neutral-600">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
