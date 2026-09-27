import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingForm } from "@/app/(dashboard)/onboarding/OnboardingForm";

// Same form as first-time onboarding (`/onboarding`), reached instead from
// the dashboard's org switcher for a user who already has at least one org
// and wants to create another — `/onboarding` itself redirects away once a
// membership exists, so it can't be reused directly for this case.
export default function NewOrganizationPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 p-6">
      <Card>
        <CardHeader>
          <CardTitle>New organization</CardTitle>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </main>
  );
}
