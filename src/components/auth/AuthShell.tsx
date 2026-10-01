import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The dark, glowing frame the landing page uses, applied to the auth
 * screens so the hand-off from "Get started" isn't a jump from a night sky
 * to a white form. The `dark` class flips every shadcn token (inputs,
 * buttons, labels) to their dark values — see `.dark` in globals.css — so
 * the form controls inside need no per-field restyling.
 */
/** The main button on the auth screens: a white pill, like "New app" on
 * the dashboard. */
export const AUTH_BUTTON =
  "group mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_10px_30px_-10px_rgba(129,140,248,0.8)] transition hover:bg-indigo-50 disabled:opacity-60 disabled:hover:bg-white";

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
    <div className="dark relative flex min-h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-50">
      {/* Same two glows as the dashboard hero, so logging in feels like one
       * continuous room. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.07)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>

      <header className="relative z-10 px-6 py-5 sm:px-10">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950 shadow-lg shadow-indigo-500/30">
            <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={2.5} />
          </span>
          TapAndLaunch
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white/[0.04] p-7 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl sm:p-9">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-neutral-400">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
          {footer && <p className="mt-6 text-center text-sm text-neutral-400">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
