"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CurrentMember } from "@/lib/pwa/get-current-member";

export function MemberAccountBar({ member }: { member: CurrentMember | null }) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/members/session", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end border-b px-3 py-1.5 text-xs text-muted-foreground">
      {member ? (
        <div className="flex items-center gap-2">
          <span>Signed in as {member.display_name ?? member.email}</span>
          <button type="button" onClick={handleSignOut} className="underline">
            Sign out
          </button>
        </div>
      ) : (
        <Link href="/members/login" className="underline">
          Sign in
        </Link>
      )}
    </div>
  );
}
