"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Plus } from "lucide-react";
import type { MembershipSummary } from "@/lib/org";

export function OrgSwitcher({
  memberships,
  activeOrganizationId,
  logoUrl,
}: {
  memberships: MembershipSummary[];
  activeOrganizationId: string;
  logoUrl?: string;
}) {
  const router = useRouter();
  const active = memberships.find((m) => m.organization_id === activeOrganizationId);

  async function switchTo(organizationId: string) {
    if (organizationId === activeOrganizationId) return;
    const res = await fetch("/api/organizations/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId }),
    });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold transition hover:bg-white/5">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant-provided storage URL
          <img src={logoUrl} alt="" className="h-5 w-5 rounded object-cover" />
        )}
        <span className="max-w-[6.5rem] truncate sm:max-w-none">{active?.name ?? "Select organization"}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {memberships.map((m) => (
          <DropdownMenuItem key={m.organization_id} onClick={() => switchTo(m.organization_id)}>
            {m.name}
            {m.organization_id === activeOrganizationId && (
              <span className="ml-auto text-xs text-muted-foreground">current</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/organizations/new" />}>
          <Plus className="h-4 w-4" />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
