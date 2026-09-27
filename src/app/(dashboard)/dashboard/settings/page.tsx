import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { OrgSettingsForm } from "./OrgSettingsForm";

export default async function OrgSettingsPage() {
  const supabase = await createClient();

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  if (!organizationId) redirect("/onboarding");

  const activeMembership = memberships.find((m) => m.organization_id === organizationId);

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  if (!organization) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
        </CardHeader>
        <CardContent>
          {activeMembership?.role === "admin" ? (
            <OrgSettingsForm organization={organization} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Only an organization admin can change these settings. You&rsquo;re a{" "}
              <strong>{activeMembership?.role}</strong> here.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
