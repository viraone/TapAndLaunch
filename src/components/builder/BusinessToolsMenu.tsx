"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BUSINESS_TOOLS } from "@/lib/apps/business-tools";

/**
 * The way from the builder into the owner's private business sections (Schedule, Customers, Reminders, Automation).
 * It only appears for apps that have Scheduling switched on; those sections live on the app's dashboard home, which
 * an owner who built from the Scheduling template otherwise has no path to from the builder.
 */
export function BusinessToolsMenu({ appId }: { appId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Business tools"
        title="Schedule, customers, reminders and automation"
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-white"
      >
        <Briefcase className="h-4 w-4" />
        {/* A narrow bar keeps the icon only; the aria-label still names the button. */}
        <span className="hidden sm:inline">Business tools</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dark w-72">
        {BUSINESS_TOOLS.map(({ path, label, hint, icon: Icon }) => (
          <DropdownMenuItem key={path} className="gap-2.5 py-2" render={<Link href={`/dashboard/apps/${appId}/${path}`} />}>
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
