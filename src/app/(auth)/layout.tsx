import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Login and signup are pointless for someone who already has a session —
 * the Supabase cookie survives browser restarts, so a returning user who
 * clicks "Log in" on the landing page should land in the dashboard, not
 * on a form asking for a password they already gave us.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return children;
}
