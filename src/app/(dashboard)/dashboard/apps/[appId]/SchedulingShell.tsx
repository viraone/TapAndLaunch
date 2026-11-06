import Link from "next/link";
import type { ReactNode } from "react";
import { BUSINESS_TOOLS } from "@/lib/apps/business-tools";

/* The same focus ring the portal's links use. */
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950";

/**
 * The left menu shared by the Scheduling admin screens: the four business sections from the app home, down the left
 * from md up and as a row above the content on a phone. It never renders a <main>; the screens own theirs.
 */
export function SchedulingShell({
  appId,
  active,
  children,
}: {
  appId: string;
  active: "home" | "schedule" | "customers" | "reminders" | "automation";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col md:flex-row md:items-stretch">
      <nav
        aria-label="Scheduling"
        className="flex w-full shrink-0 gap-1 overflow-x-auto bg-neutral-100 p-3 md:w-60 md:flex-col md:overflow-visible"
      >
        {BUSINESS_TOOLS.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            href={`/dashboard/apps/${appId}/${path}`}
            aria-current={path === active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-[15px] font-medium transition ${FOCUS} ${
              path === active
                ? "bg-neutral-200 text-neutral-950"
                : "text-neutral-700 hover:bg-neutral-200/60 hover:text-neutral-950"
            }`}
          >
            <Icon aria-hidden className="h-4 w-4 text-neutral-950" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
