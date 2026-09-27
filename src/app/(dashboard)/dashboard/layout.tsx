import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organization_id, organizations(name)")
    .limit(1);

  if (!memberships || memberships.length === 0) redirect("/onboarding");

  const orgName = (memberships[0] as { organizations: { name: string } | null }).organizations?.name;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/dashboard" className="font-semibold">
          {orgName ?? "Dashboard"}
        </Link>
        <SignOutButton />
      </header>
      {children}
    </div>
  );
}
