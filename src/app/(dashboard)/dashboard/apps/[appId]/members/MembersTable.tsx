"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Database } from "@/types/database";
import { LocalTime } from "@/components/dashboard/LocalTime";

type MemberRow = Database["public"]["Tables"]["app_members"]["Row"];

export function MembersTable({ appId, members }: { appId: string; members: Omit<MemberRow, "password_hash">[] }) {
  const router = useRouter();
  const [tierDrafts, setTierDrafts] = useState<Record<string, string>>(
    Object.fromEntries(members.map((m) => [m.id, m.tier]))
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function saveTier(memberId: string) {
    const tier = tierDrafts[memberId] ?? "default";
    setPendingId(memberId);
    try {
      const res = await fetch(`/api/apps/${appId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to update tier");
        return;
      }
      toast.success("Tier updated");
    } finally {
      setPendingId(null);
    }
  }

  async function removeMember(memberId: string) {
    setPendingId(memberId);
    try {
      const res = await fetch(`/api/apps/${appId}/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Failed to remove member");
        return;
      }
      toast.success("Member removed");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 font-medium">Email</th>
          <th className="py-2 font-medium">Name</th>
          <th className="py-2 font-medium">Phone</th>
          <th className="py-2 font-medium">Tier</th>
          <th className="py-2 font-medium">Joined</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id} className="border-b last:border-b-0">
            <td className="py-2">{member.email}</td>
            <td className="py-2">{member.display_name ?? "—"}</td>
            <td className="py-2">{member.phone ?? "—"}</td>
            <td className="py-2">
              <div className="flex items-center gap-1">
                <Input
                  value={tierDrafts[member.id] ?? ""}
                  onChange={(e) => setTierDrafts((prev) => ({ ...prev, [member.id]: e.target.value }))}
                  className="h-7 w-28"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pendingId === member.id}
                  onClick={() => saveTier(member.id)}
                >
                  Save
                </Button>
              </div>
            </td>
            <td className="py-2 text-muted-foreground"><LocalTime iso={member.created_at} dateOnly /></td>
            <td className="py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pendingId === member.id}
                onClick={() => removeMember(member.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
