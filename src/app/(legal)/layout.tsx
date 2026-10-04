import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LegalLinks } from "@/components/legal/Doc";
import { BRAND, LEGAL_NAME } from "@/lib/legal";

/** The dark look of the landing page and sign-in screens, around plain readable text. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark relative flex min-h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-50">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-pink-500/15 blur-3xl" />
      </div>
      <header className="relative z-10 px-6 py-5 sm:px-10">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950 shadow-lg shadow-indigo-500/30">
            <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={2.5} />
          </span>
          {BRAND}
        </Link>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-6 sm:px-10">{children}</main>
      <footer className="relative z-10 space-y-2 px-6 py-8 text-center text-xs text-neutral-500">
        <LegalLinks />
        <p>
          © {new Date().getFullYear()} {LEGAL_NAME}, doing business as {BRAND}
        </p>
      </footer>
    </div>
  );
}
