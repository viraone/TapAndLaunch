import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The auth screens in the same light, editorial style as the home page and the template picker: a white page, a big
 * headline, and a plain form with no card around it. (The shadcn tokens are the light ones, so the inputs, labels and
 * checkbox inside need no per-field restyling.)
 */
/** The main button on the auth screens: the brand gradient, like the home page's "Start your free trial". */
export const AUTH_BUTTON =
  "group mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.6)] transition hover:brightness-110 disabled:opacity-60";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-neutral-950">
      <header className="mx-auto w-full max-w-[1400px] px-6 py-5 sm:px-10">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-white shadow-lg shadow-indigo-500/20">
            <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={2.5} />
          </span>
          TapAndLaunch
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-8 sm:pt-16">
        <div className="w-full max-w-md">
          <h1 className="text-balance text-5xl font-medium leading-[1] tracking-[-0.04em] sm:text-6xl">{title}</h1>
          {subtitle && <p className="mt-4 text-lg text-neutral-600">{subtitle}</p>}
          <div className="mt-10 [&_input]:rounded-xl">{children}</div>
          {footer && <p className="mt-8 border-t border-neutral-200 pt-6 text-sm text-neutral-500">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
