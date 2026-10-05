import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, Globe, LayoutTemplate, ShoppingBag, Sparkles, Users, Check, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LegalLinks } from "@/components/legal/Doc";
import { LEGAL_NAME } from "@/lib/legal";
import { PLAN, TRIAL_DAYS } from "@/lib/billing/plans";
import { AUDIENCES, FAQ, FEATURES, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, STEPS } from "@/lib/marketing";
import { siteOrigin } from "@/lib/site";

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

const ICONS = [LayoutTemplate, Globe, Users, Bell, ShoppingBag, Sparkles];

const money = (cents: number) => `$${Math.round(cents / 100)}`;

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
          { "@type": "Offer", name: `${PLAN.name}, billed yearly`, price: (PLAN.yearlyCents / 100).toFixed(2), priceCurrency: "USD" },
          { "@type": "Offer", name: `${PLAN.name}, billed monthly`, price: (PLAN.monthlyCents / 100).toFixed(2), priceCurrency: "USD" },
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
  // `<` is escaped so nothing inside the data can close the script tag.
  const jsonLd = JSON.stringify(structuredData()).replace(/</g, "\\u003c");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {/* Backdrop: a soft radial glow + a faint grid, both purely decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-20%] h-[70vh] w-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.35),rgba(236,72,153,0.18)_45%,transparent_70%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950 shadow-lg shadow-indigo-500/30">
            <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={2.5} />
          </span>
          TapAndLaunch
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
          <a href="#pricing" className="hidden rounded-full px-4 py-2 text-neutral-300 transition hover:bg-white/5 hover:text-white sm:inline-block">
            Pricing
          </a>
          <a href="#faq" className="hidden rounded-full px-4 py-2 text-neutral-300 transition hover:bg-white/5 hover:text-white sm:inline-block">
            FAQ
          </a>
          {signedIn ? (
            <Link href="/dashboard" className="rounded-full bg-white px-4 py-2 font-medium text-neutral-950 transition hover:bg-neutral-200">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-neutral-300 transition hover:bg-white/5 hover:text-white">
                Log in
              </Link>
              <Link href="/signup" className="rounded-full bg-white px-4 py-2 font-medium text-neutral-950 transition hover:bg-neutral-200">
                Start free
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-20 pt-10 text-center sm:pt-16">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          Free for {TRIAL_DAYS} days · No card needed · No code
        </span>

        <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          Your app, one{" "}
          <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">tap from launch</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-base text-neutral-400 sm:text-lg">
          Build an app for your restaurant, gym, shop or event in minutes, without writing code. Share it with a link or QR code, take card
          payments, and send push notifications to everyone who installs it.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href={signedIn ? "/dashboard" : "/signup"}
            className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-pink-500/30 hover:brightness-110"
          >
            {signedIn ? "Go to your dashboard" : "Start your free trial"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          {!signedIn && (
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-neutral-200 backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              I already have an account
            </Link>
          )}
        </div>

        <section aria-labelledby="built-for" className="mt-16 w-full max-w-3xl">
          <h2 id="built-for" className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Built for
          </h2>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {AUDIENCES.map((a) => (
              <li key={a} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300">
                {a}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="features" className="mt-24 w-full max-w-5xl">
          <h2 id="features" className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything your app needs, in one place
          </h2>
          <ul className="mt-10 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ title, body }, i) => {
              const Icon = ICONS[i] ?? Sparkles;
              return (
                <li key={title} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]">
                  <Icon className="mb-3 h-5 w-5 text-indigo-300 transition group-hover:text-pink-300" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-400">{body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="how" className="mt-24 w-full max-w-4xl">
          <h2 id="how" className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            From idea to live app in three steps
          </h2>
          <ol className="mt-10 grid gap-3 text-left sm:grid-cols-3">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-pink-400 text-sm font-bold text-neutral-950">{i + 1}</span>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-400">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="mt-24 w-full max-w-3xl scroll-mt-8">
          <h2 id="pricing-title" className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            One simple plan
          </h2>
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-left backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-indigo-300">{PLAN.name}</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-5xl font-semibold tracking-tight">{money(PLAN.yearlyCents / 12)}</span>
                  <span className="text-neutral-400">/month, billed yearly ({money(PLAN.yearlyCents)})</span>
                </p>
                <p className="mt-1 text-sm text-neutral-400">or {money(PLAN.monthlyCents)}/month if you prefer to pay monthly</p>
              </div>
              <Link
                href={signedIn ? "/dashboard/settings" : "/signup"}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
              >
                {signedIn ? "Choose a plan" : `Start ${TRIAL_DAYS} days free`}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="mt-6 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
              {["Everything included, no feature locks", `${TRIAL_DAYS}-day free trial, no card needed`, "Your apps on their own web address", "Push notifications and email", "Card payments through your Stripe account", "Cancel any time"].map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className="mt-24 w-full max-w-3xl scroll-mt-8 text-left">
          <h2 id="faq-title" className="text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Questions, answered
          </h2>
          <div className="mt-10 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold marker:content-none">
                  {q}
                  <span aria-hidden className="text-neutral-500 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="final" className="mt-24 w-full max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-pink-500/10 p-10">
          <Smartphone className="mx-auto h-8 w-8 text-indigo-200" />
          <h2 id="final" className="mt-4 text-balance text-3xl font-semibold tracking-tight">
            Your first app can be live today
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-300">Start the {TRIAL_DAYS}-day free trial. No card, no code, and you can cancel any time.</p>
          <Link
            href={signedIn ? "/dashboard" : "/signup"}
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
          >
            {signedIn ? "Go to your dashboard" : "Start your free trial"} <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="relative z-10 space-y-2 px-6 py-6 text-center text-xs text-neutral-500">
        <LegalLinks />
        <p>
          © {new Date().getFullYear()} {LEGAL_NAME}, doing business as TapAndLaunch
        </p>
      </footer>
    </div>
  );
}
