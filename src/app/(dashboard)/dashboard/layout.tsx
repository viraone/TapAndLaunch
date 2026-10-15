import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LayoutGrid, Settings, ShieldCheck } from "lucide-react";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { OrgSwitcher } from "@/components/dashboard/OrgSwitcher";
import { bannerFor, billingState } from "@/lib/billing/plans";

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

  const { data: billingRow } = await supabase.from("org_billing").select("*").eq("organization_id", activeOrganizationId).maybeSingle();
  const banner = bannerFor(billingState(billingRow, new Date()));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative z-20 border-b border-neutral-200 bg-white text-neutral-950">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-10">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Always-visible way home: every dashboard page, however deep
             * (builder, analytics, org settings), is one click from the app
             * list. */}
            <Link href="/dashboard" aria-label="All apps" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-pink-400 text-white shadow-lg shadow-indigo-500/20">
                <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={2.5} />
              </span>
              <span className="hidden sm:inline">TapAndLaunch</span>
            </Link>
            {/* "Browse Templates" used to sit here too; "New app" on the dashboard is the one way to start. The organization
             * switcher only appears for someone who belongs to more than one: for everyone else it was a name they could
             * not do anything with. A new organization can still be made from Settings. */}
            {memberships.length > 1 && (
              <>
                <span className="h-6 w-px bg-neutral-200" aria-hidden />
                <OrgSwitcher
                  memberships={memberships}
                  activeOrganizationId={activeOrganizationId}
                  logoUrl={activeOrg?.branding.logo_url}
                />
              </>
            )}
          </div>
          <nav className="flex items-center gap-0.5 text-[15px] sm:gap-1">
            <Link
              aria-label="Apps"
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-[15px] font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950 sm:px-3.5"
            >
              <LayoutGrid className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">Apps</span>
            </Link>
            {platformAdmin && (
              <Link
                aria-label="Admin"
                href="/dashboard/admin"
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-[15px] font-medium text-indigo-600 transition hover:bg-neutral-100 hover:text-indigo-700 sm:px-3.5"
              >
                <ShieldCheck className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <Link
              aria-label="Settings"
              href="/dashboard/settings"
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-[15px] font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950 sm:px-3.5"
            >
              <Settings className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">Settings</span>
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      {banner && (
        <Link
          href="/dashboard/settings"
          className={`flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium ${banner.tone === "warn" ? "bg-amber-100 text-amber-950" : "bg-indigo-50 text-indigo-950"}`}
        >
          {banner.text} <span className="underline">{banner.action}</span>
        </Link>
      )}
      {children}
    </div>
  );
}
