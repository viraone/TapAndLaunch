import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventCalendarBlockConfig } from "@/types/database";
import { linked } from "@/lib/builder/field-link";

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
          {...linked("title")}
          value={config.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>View</Label>
        <Select
          value={config.view ?? "list"}
          items={{ list: "List", month: "Month" }}
          onValueChange={(value) => onChange({ ...config, view: value as EventCalendarBlockConfig["view"] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.booking !== false}
          onChange={(e) => onChange({ ...config, booking: e.target.checked ? undefined : false })}
        />
        Let people book
      </label>
      <p className="text-xs text-muted-foreground">
        Shows every upcoming event.{" "}
        <Link href={`/dashboard/apps/${appId}/events`} className="underline" target="_blank">
          Manage events
        </Link>
      </p>
    </div>
  );
}
