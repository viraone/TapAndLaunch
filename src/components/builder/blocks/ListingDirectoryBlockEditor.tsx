import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ListingDirectoryBlockConfig } from "@/types/database";

/** The open-mic directory shows the app's active listings that happen today.
 * Listings are loaded with scripts/listings-to-sql.mjs for now (the dashboard
 * has no listings page yet). The time zone is shown, not edited: the ported
 * engine in src/lib/listings always works out "today" in Seattle time. */
export function ListingDirectoryBlockEditor({
  config,
  onChange,
}: {
  config: ListingDirectoryBlockConfig;
  onChange: (config: ListingDirectoryBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="listing-directory-title">Title</Label>
        <Input
          id="listing-directory-title"
          value={config.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {`Shows the open mics happening today. Time zone: ${config.time_zone ?? "America/Los_Angeles"}`}
      </p>
    </div>
  );
}
