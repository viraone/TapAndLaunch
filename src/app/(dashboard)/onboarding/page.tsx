import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("organization_id")
    .limit(1)
    .maybeSingle();

  if (existingMembership) redirect("/dashboard");

  return (
    <AuthShell title="Create your organization" subtitle="Give your workspace a name to get started.">
      <OnboardingForm />
    </AuthShell>
  );
}
