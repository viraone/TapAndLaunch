import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const supabase = await createClient();
  const { next } = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingMembership) redirect("/dashboard");

  // A page that sent someone here (`?next=/domains?q=…`) wins. Otherwise use the path sign-up saved on the account:
  // the confirmation email's link cannot carry it (prod's template hardcodes /onboarding). Both are checked as
  // same-site paths, so a value from the URL or from account metadata can never send anyone to another site.
  const fromQuery = typeof next === "string" ? safeNextPath(next, "") : "";
  const signupNext = typeof user.user_metadata?.signup_next === "string" ? user.user_metadata.signup_next : null;
  const nextPath = fromQuery || safeNextPath(signupNext, "/dashboard");

  return (
    <AuthShell title="Create your organization" subtitle="Give your workspace a name to get started.">
      <OnboardingForm next={nextPath} />
    </AuthShell>
  );
}
