import { Loader2 } from "lucide-react";

/**
 * Shown in the page area the instant a tab is tapped, while the server renders the page. Published app pages are
 * dynamic (they read the app from the database and the host cookie), so without this boundary Next.js skips
 * prefetching them and the tab bar seems to ignore the tap until the server answers. With it, the shared layout
 * and this spinner are prefetched, the switch is immediate, and the page streams in behind it.
 */
export default function Loading() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Loading">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
