import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LayoutGrid, Settings, ShieldCheck } from "lucide-react";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { OrgSwitcher } from "@/components/dashboard/OrgSwitcher";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await getMemberships(supabase);
  if (memberships.length === 0) redirect("/onboarding");

  const activeOrganizationId = await getActiveOrganizationId(supabase, memberships);
  if (!activeOrganizationId) redirect("/onboarding");

  const platformAdmin = await isPlatformAdmin(supabase);

  const { data: activeOrg } = await supabase
    .from("organizations")
    .select("branding")
    .eq("id", activeOrganizationId)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="dark relative z-20 flex h-14 items-center justify-between border-b border-white/10 bg-neutral-950 px-4 text-neutral-50">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
        <div className="flex items-center gap-3">
          {/* Always-visible way home: every dashboard page, however deep
           * (builder, analytics, org settings), is one click from the app
           * list. */}
          <Link href="/dashboard" aria-label="All apps" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950 shadow-lg shadow-indigo-500/30">
              <ArrowRight className="h-3.5 w-3.5 -rotate-45" strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline">TapAndLaunch</span>
          </Link>
          <span className="h-5 w-px bg-white/10" aria-hidden />
          <OrgSwitcher
            memberships={memberships}
            activeOrganizationId={activeOrganizationId}
            logoUrl={activeOrg?.branding.logo_url}
          />
        </div>
        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          <Link
            aria-label="Apps"
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Apps</span>
          </Link>
          {platformAdmin && (
            <Link
              aria-label="Admin"
              href="/dashboard/admin"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 text-indigo-300 transition hover:bg-white/5 hover:text-indigo-200"
            >
              <ShieldCheck className="h-4 w-4" /> <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link
            aria-label="Settings"
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
          </Link>
          <SignOutButton />
        </nav>
      </header>
      {children}
    </div>
  );
}
