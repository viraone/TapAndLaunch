import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { EventCalendarBlockConfig } from "@/types/database";

/** Events are managed on their own dashboard page — this block always shows
 * every upcoming event for the app. */
export function EventCalendarBlockEditor({
  config,
  appId,
  onChange,
}: {
  config: EventCalendarBlockConfig;
  appId: string;
  onChange: (config: EventCalendarBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="event-calendar-title">Title</Label>
        <Input
          id="event-calendar-title"
          value={config.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Shows every upcoming event.{" "}
        <Link href={`/dashboard/apps/${appId}/events`} className="underline" target="_blank">
          Manage events
        </Link>
      </p>
    </div>
  );
}
