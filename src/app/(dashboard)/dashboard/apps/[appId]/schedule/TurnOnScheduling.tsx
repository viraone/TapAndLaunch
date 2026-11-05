"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Used when the browser cannot list its time zones; covers the US zones. */
const FALLBACK_ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const DEFAULT_ZONE = "America/Los_Angeles";

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}

function allTimeZones(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // Older browsers: use the short list.
  }
  return [...FALLBACK_ZONES];
}

/** The card that turns Scheduling on for an app. A settings row is the switch. */
export function TurnOnScheduling({ appId }: { appId: string }) {
  const router = useRouter();
  const [zones, setZones] = useState<string[]>(FALLBACK_ZONES);
  const [timeZone, setTimeZone] = useState(DEFAULT_ZONE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The browser's zone is only known on the client, so it is picked after
  // hydration to keep the server and first client render identical. Deferred
  // by a tick so setState never runs synchronously inside the effect.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const zone = browserTimeZone();
      const options = allTimeZones();
      if (!options.includes(zone)) options.push(zone);
      options.sort((a, b) => a.localeCompare(b));
      setZones(options);
      setTimeZone(zone);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const zoneItems: Record<string, string> = Object.fromEntries(
    zones.map((zone) => [zone, zone])
  );

  async function handleTurnOn() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/schedule/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time_zone: timeZone }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "Could not turn on scheduling. Try again.");
        return;
      }
      toast.success("Scheduling is on");
      router.refresh();
    } catch {
      setError("Could not turn on scheduling. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Scheduling</CardTitle>
        <CardDescription>Keep your customers and visits here. Reminders come next.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="schedule-time-zone">Time zone</Label>
        <Select value={timeZone} items={zoneItems} onValueChange={(value) => setTimeZone(String(value))}>
          <SelectTrigger id="schedule-time-zone" className="h-11 w-full sm:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {zones.map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Visits are saved in this time zone.</p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button type="button" className="h-11 px-4 sm:h-8" disabled={saving} onClick={handleTurnOn}>
          {saving ? "Turning on…" : "Turn on scheduling"}
        </Button>
      </CardFooter>
    </Card>
  );
}
