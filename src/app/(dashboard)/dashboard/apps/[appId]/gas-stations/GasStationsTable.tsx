"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Database } from "@/types/database";

type StationRow = Database["public"]["Tables"]["gas_stations"]["Row"];

function money(v: number | null): string {
  return v === null ? "—" : `$${Number(v).toFixed(2)}`;
}

export function GasStationsTable({ appId, stations }: { appId: string; stations: StationRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function remove(id: string) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/apps/${appId}/gas-stations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Failed to delete");
        return;
      }
      toast.success("Station removed");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (stations.length === 0) {
    return <p className="text-sm text-muted-foreground">No stations yet — open the published app to populate this area.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 font-medium">Station</th>
          <th className="py-2 font-medium text-right">Regular</th>
          <th className="py-2 font-medium text-right">Mid</th>
          <th className="py-2 font-medium text-right">Premium</th>
          <th className="py-2 font-medium text-right">Diesel</th>
          <th className="py-2 font-medium">Source</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {stations.map((s) => (
          <tr key={s.id} className="border-b last:border-b-0">
            <td className="py-2">
              <p className="font-medium">{s.station_name}</p>
              <p className="text-xs text-muted-foreground">{s.address ?? `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`}</p>
            </td>
            <td className="py-2 text-right tabular-nums">{money(s.price_regular)}</td>
            <td className="py-2 text-right tabular-nums">{money(s.price_midgrade)}</td>
            <td className="py-2 text-right tabular-nums">{money(s.price_premium)}</td>
            <td className="py-2 text-right tabular-nums">{money(s.price_diesel)}</td>
            <td className="py-2 text-xs text-muted-foreground">{s.price_source ?? "—"}</td>
            <td className="py-2 text-right">
              <Button type="button" variant="ghost" size="icon" disabled={pendingId === s.id} onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
