"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" className="min-h-11 rounded-full px-3.5 text-[15px] text-neutral-400 hover:text-white" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
