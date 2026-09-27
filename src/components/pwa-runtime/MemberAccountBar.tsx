"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CurrentMember } from "@/lib/pwa/get-current-member";
import { PushOptIn } from "@/components/pwa-runtime/PushOptIn";

export function MemberAccountBar({ member }: { member: CurrentMember | null }) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/members/session", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-3 border-b px-3 py-1.5 text-xs text-muted-foreground">
      <PushOptIn />
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
