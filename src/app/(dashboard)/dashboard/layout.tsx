import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LayoutGrid, Settings } from "lucide-react";
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

  const { data: activeOrg } = await supabase
    .from("organizations")
    .select("branding")
    .eq("id", activeOrganizationId)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          {/* Always-visible way home: every dashboard page, however deep
           * (builder, analytics, org settings), is one click from the app
           * list. */}
          <Link href="/dashboard" aria-label="All apps" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950">
              <ArrowRight className="h-3.5 w-3.5 -rotate-45" strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline">TapAndLaunch</span>
          </Link>
          <span className="h-5 w-px bg-border" aria-hidden />
          <OrgSwitcher
            memberships={memberships}
            activeOrganizationId={activeOrganizationId}
            logoUrl={activeOrg?.branding.logo_url}
          />
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LayoutGrid className="h-4 w-4" /> Apps
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <SignOutButton />
        </nav>
      </header>
      {children}
    </div>
  );
}
