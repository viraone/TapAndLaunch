import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LegalLinks } from "@/components/legal/Doc";
import { LEGAL_NAME } from "@/lib/legal";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { AUDIENCES, FAQ, FEATURES, LISTED_PRICE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, STEPS } from "@/lib/marketing";
import { siteOrigin } from "@/lib/site";
import { STARTER_TEMPLATES, buildStarter, type StarterTemplate } from "@/lib/apps/templates";
import { fontsHref } from "@/lib/pwa/theme-style";
import { TemplatePreview } from "@/components/dashboard/TemplatePreview";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og", width: 1200, height: 630, alt: "TapAndLaunch: your app, one tap from launch" }],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/og"] },
};

// A handful of the website starters, one per flavour, so the home page shows real previews (drawn by the same code
// as the template picker, so they never drift from what a customer gets).
const SHOWCASE = ["photography", "design", "art", "marketing", "technology", "beauty"] as const;
const SHOWCASE_TEMPLATES = SHOWCASE.map((id) => STARTER_TEMPLATES.find((t) => t.id === id)).filter((t): t is StarterTemplate => !!t);
const SHOWCASE_FONTS = Array.from(new Set(SHOWCASE_TEMPLATES.map((t) => fontsHref(buildStarter(t.id, "x").theme)).filter((h): h is string => !!h)));

/** What search engines read to understand the page: who we are, what the product is, and the questions answered below. */
function structuredData() {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${origin}/#org`, name: SITE_NAME, url: origin },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: origin,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        offers: [
          { "@type": "Offer", name: `${LISTED_PRICE.name}, billed yearly`, price: LISTED_PRICE.dollarsPerYear.toFixed(2), priceCurrency: "USD" },
          { "@type": "Offer", name: `${LISTED_PRICE.name}, billed monthly`, price: LISTED_PRICE.dollarsPerMonth.toFixed(2), priceCurrency: "USD" },
        ],
        publisher: { "@id": `${origin}/#org` },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  };
}

export default async function Home() {
  // A returning user with a live session gets "Dashboard" links instead of
  // being asked to log in again.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;
  const startHref = signedIn ? "/dashboard" : "/signup";
  // `<` is escaped so nothing inside the data can close the script tag.
  const jsonLd = JSON.stringify(structuredData()).replace(/</g, "\\u003c");

  const pill = "rounded-full px-4 py-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950";
  const dark = "inline-flex min-h-12 items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800";

  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-neutral-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {SHOWCASE_FONTS.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}

      <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-white shadow-lg shadow-indigo-500/20">
            <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={2.5} />
          </span>
          TapAndLaunch
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
          <a href="#pricing" className={`hidden sm:inline-block ${pill}`}>
            Pricing
          </a>
          <a href="#faq" className={`hidden sm:inline-block ${pill}`}>
            FAQ
          </a>
          {signedIn ? (
            <Link href="/dashboard" className="rounded-full bg-neutral-950 px-4 py-2 font-medium text-white transition hover:bg-neutral-800">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={pill}>
                Log in
              </Link>
              <Link href="/signup" className="rounded-full bg-neutral-950 px-4 py-2 font-medium text-white transition hover:bg-neutral-800">
                Start free
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 pb-24 sm:px-10">
        <section className="grid gap-8 pb-14 pt-10 sm:pt-16 lg:grid-cols-2 lg:items-end lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Free for {TRIAL_DAYS} days · No card needed · No code
            </p>
            <h1 className="mt-4 text-balance text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl lg:text-8xl">Your app, one tap from launch.</h1>
          </div>
          <div className="max-w-xl">
            <p className="text-lg leading-relaxed text-neutral-700">
              Build an app for your restaurant, gym, shop or event in minutes, without writing code. Share it with a link or QR code, take card
              payments, and send push notifications to everyone who installs it.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link href={startHref} className={`group ${dark}`}>
                {signedIn ? "Go to your dashboard" : "Start your free trial"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {!signedIn && (
                <Link href="/login" className="inline-flex min-h-12 items-center rounded-full px-4 text-sm font-medium text-neutral-600 transition hover:text-neutral-950">
                  I already have an account
                </Link>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="templates" className="border-t border-neutral-200 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="templates" className="text-base font-medium">
              Start from a template that already looks like you
            </h2>
            <Link href={startHref} className="text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-950 hover:underline">
              See all templates
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE_TEMPLATES.map((t) => (
              <li key={t.id}>
                <Link href={startHref} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-black/10">
                    <div className="h-full w-full transition duration-500 ease-out group-hover:scale-[1.03]">
                      <TemplatePreview templateId={t.id} color={t.color} />
                    </div>
                  </div>
                  <p className="mt-3.5 text-[17px] font-medium tracking-tight">{t.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="built-for" className="mt-24 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-6">
          <h2 id="built-for" className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Built for
          </h2>
          <ul className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <li key={a} className="rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-700">
                {a}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="features" className="mt-24">
          <h2 id="features" className="max-w-3xl text-balance text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            Everything your app needs, in one place
          </h2>
          <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ title, body }) => (
              <li key={title} className="border-t border-neutral-950 pt-4">
                <h3 className="text-lg font-medium tracking-tight">{title}</h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how" className="mt-24">
          <h2 id="how" className="max-w-3xl text-balance text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            From idea to live app in three steps
          </h2>
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-3">
            {STEPS.map(({ title, body }, i) => (
              <li key={title}>
                <span className="text-6xl font-medium tracking-[-0.04em] text-neutral-300">{i + 1}</span>
                <h3 className="mt-3 text-lg font-medium tracking-tight">{title}</h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="mt-24 scroll-mt-8">
          <h2 id="pricing-title" className="text-balance text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            One simple plan
          </h2>
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
              <Link href={signedIn ? "/dashboard/settings" : "/signup"} className={dark}>
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

        <section id="faq" aria-labelledby="faq-title" className="mt-24 scroll-mt-8">
          <h2 id="faq-title" className="text-balance text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            Questions, answered
          </h2>
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

        <section aria-labelledby="final" className="mt-24 rounded-3xl bg-neutral-950 px-8 py-16 text-center text-white sm:py-24">
          <h2 id="final" className="mx-auto max-w-3xl text-balance text-4xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl">
            Your first app can be live today
          </h2>
          <p className="mx-auto mt-4 max-w-md text-neutral-400">Start the {TRIAL_DAYS}-day free trial. No card, no code, and you can cancel any time.</p>
          <Link
            href={startHref}
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
          >
            {signedIn ? "Go to your dashboard" : "Start your free trial"} <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="space-y-2 border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-500">
        <LegalLinks className="[&_a]:hover:text-neutral-950" />
        <p>
          © {new Date().getFullYear()} {LEGAL_NAME}, doing business as TapAndLaunch
        </p>
      </footer>
    </div>
  );
}
