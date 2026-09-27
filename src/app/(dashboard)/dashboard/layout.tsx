import { redirect } from "next/navigation";
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
        <OrgSwitcher
          memberships={memberships}
          activeOrganizationId={activeOrganizationId}
          logoUrl={activeOrg?.branding.logo_url}
        />
        <SignOutButton />
      </header>
      {children}
    </div>
  );
}
