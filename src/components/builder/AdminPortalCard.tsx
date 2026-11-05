"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The right-hand panel for a Scheduling app: its public page is optional, and the tools its owner uses every day
 * (schedule, customers, reminders, automation) live in the app's Admin portal. Replaces "Get live" and "Next up",
 * which push a website the owner does not need.
 */
export function AdminPortalCard({ appId }: { appId: string }) {
  return (
    <section aria-labelledby="admin-portal-card-heading" className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <h2 id="admin-portal-card-heading" className="text-base font-semibold text-neutral-50">
        This is your optional public page
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-neutral-300">
        Your day-to-day tools (schedule, customers, reminders and messages) are in your Admin portal.
      </p>
      <Link
        href={`/dashboard/apps/${appId}`}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
      >
        Open Admin portal <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
      <p className="mt-2.5 text-sm leading-relaxed text-neutral-400">
        You don&apos;t need to publish this page to use your tools.
      </p>
    </section>
  );
}
