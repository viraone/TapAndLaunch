import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LegalLinks } from "@/components/legal/Doc";
import { LEGAL_NAME } from "@/lib/legal";

/** The pill style shared by the quiet links and buttons of the public pages. */
export const NAV_PILL = "rounded-full px-4 py-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950";
/** The brand-gradient call to action. */
export const CTA_BUTTON =
  "inline-flex min-h-12 items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110";

/** The top of the home, pricing and FAQ pages: the logo, Pricing and FAQ (real pages), then log in or the dashboard. */
export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-5 sm:px-10">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-white shadow-lg shadow-indigo-500/20">
          <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={2.5} />
        </span>
        TapAndLaunch
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
        <Link href="/for" className={`hidden sm:inline-block ${NAV_PILL}`}>
          Trades
        </Link>
        <Link href="/domains" className={`hidden sm:inline-block ${NAV_PILL}`}>
          Domains
        </Link>
        <Link href="/site-check" className={`hidden sm:inline-block ${NAV_PILL}`}>
          Site check
        </Link>
        <Link href="/pricing" className={`hidden sm:inline-block ${NAV_PILL}`}>
          Pricing
        </Link>
        <Link href="/faq" className={`hidden sm:inline-block ${NAV_PILL}`}>
          FAQ
        </Link>
        {signedIn ? (
          <Link href="/dashboard" className="rounded-full px-4 py-2 font-medium bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110">
            Dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className={NAV_PILL}>
              Log in
            </Link>
            <Link href="/signup" className="rounded-full px-4 py-2 font-medium bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110">
              Start free
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="space-y-2 border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-500">
      <LegalLinks className="[&_a]:hover:text-neutral-950" />
      <p>
        © {new Date().getFullYear()} {LEGAL_NAME}, doing business as TapAndLaunch
      </p>
    </footer>
  );
}
