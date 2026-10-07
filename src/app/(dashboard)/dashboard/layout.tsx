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
      <header className="dark relative z-20 flex h-16 items-center justify-between border-b border-white/10 bg-neutral-950 px-4 text-neutral-50 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
        <div className="flex items-center gap-3">
          {/* Always-visible way home: every dashboard page, however deep
           * (builder, analytics, org settings), is one click from the app
           * list. */}
          <Link href="/dashboard" aria-label="All apps" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950 shadow-lg shadow-indigo-500/30">
              <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline">TapAndLaunch</span>
          </Link>
          {/* "Browse Templates" used to sit here too; "New app" on the dashboard is the one way to start. The organization
           * switcher only appears for someone who belongs to more than one: for everyone else it was a name they could
           * not do anything with. A new organization can still be made from Settings. */}
          {memberships.length > 1 && (
            <>
              <span className="h-6 w-px bg-white/10" aria-hidden />
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
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-neutral-50 transition hover:bg-white/5 sm:px-3.5"
          >
            <LayoutGrid className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">Apps</span>
          </Link>
          {platformAdmin && (
            <Link
              aria-label="Admin"
              href="/dashboard/admin"
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-indigo-300 transition hover:bg-white/5 hover:text-indigo-200 sm:px-3.5"
            >
              <ShieldCheck className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link
            aria-label="Settings"
            href="/dashboard/settings"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-neutral-50 transition hover:bg-white/5 sm:px-3.5"
          >
            <Settings className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">Settings</span>
          </Link>
          <SignOutButton />
        </nav>
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
