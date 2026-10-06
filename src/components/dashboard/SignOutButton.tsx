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
    <Button type="button" variant="ghost" className="min-h-11 rounded-full px-3.5 text-[15px] font-semibold text-neutral-50 hover:bg-white/5 hover:text-neutral-50" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
