import Link from "next/link";
import { ArrowRight, Bell, Globe, LayoutTemplate, ShoppingBag, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  { icon: LayoutTemplate, title: "Drag-and-drop builder", body: "Text, media, forms, shops, events — arrange it all on a live phone preview." },
  { icon: Globe, title: "Instant PWA", body: "Every app ships with a manifest, offline caching, and installs to the home screen." },
  { icon: Users, title: "Members & gating", body: "Sign-ups inside your app, tiers, and content only members can see." },
  { icon: Bell, title: "Push, email, SMS", body: "Reach everyone, or just one tier, from a single compose screen." },
  { icon: ShoppingBag, title: "Shop & bookings", body: "Products with order requests, events with capacity-aware booking." },
  { icon: Sparkles, title: "Your domain", body: "Publish to a subdomain in one click, or connect a custom domain." },
];

export default async function Home() {
  // A returning user with a live session gets "Dashboard" links instead of
  // being asked to log in again.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-50">
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
        <nav className="flex items-center gap-2 text-sm">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-4 py-2 font-medium text-neutral-950 transition hover:bg-neutral-200"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-neutral-300 transition hover:bg-white/5 hover:text-white">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-white px-4 py-2 font-medium text-neutral-950 transition hover:bg-neutral-200"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-10 text-center sm:pt-16">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          No-code · PWA · Multi-tenant
        </span>

        <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          Your app, one{" "}
          <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
            tap from launch
          </span>
          .
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base text-neutral-400 sm:text-lg">
          Build a progressive web app in minutes, publish it to your own domain, and keep your
          audience close with members, push, and a built-in shop — without writing code.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href={signedIn ? "/dashboard" : "/signup"}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-pink-500/30 hover:brightness-110"
          >
            {signedIn ? "Go to your dashboard" : "Launch your first app"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          {!signedIn && (
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-neutral-200 backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              I already have an account
            </Link>
          )}
        </div>

        <ul className="mt-24 grid w-full max-w-5xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <Icon className="mb-3 h-5 w-5 text-indigo-300 transition group-hover:text-pink-300" />
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-neutral-400">{body}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="relative z-10 px-6 py-6 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} TapAndLaunch
      </footer>
    </div>
  );
}
