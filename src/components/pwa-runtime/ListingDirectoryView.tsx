import type { RuntimeListing } from "@/lib/pwa/listings";
import { normalizeOpenMicRecord, type OpenMic } from "@/lib/listings/record";
import { selectOpenMicsForSeattleDate } from "@/lib/listings/select";
import { formatSeattleCalendarDate } from "@/lib/listings/time";
import { ListingCard } from "@/components/pwa-runtime/ListingCard";

/** Today's open mics in a published Listing directory, as StageTime's map view
 * shows them for today (renderOpenMicMapView in its app.js): the header, then a
 * card for each mic happening today in Seattle, in start-time order, with the
 * Next Open Mic badge. `now` is passed in so the view can be tested at a fixed
 * time; ListingDirectoryRuntime gives it the browser's clock. */
export function ListingDirectoryView({ listings, now }: { listings: RuntimeListing[]; now: Date }) {
  const mics = listings
    .map((listing) => normalizeOpenMicRecord(listing.record))
    .filter((mic): mic is OpenMic => mic !== null);
  const { dayName, todays, nextMic } = selectOpenMicsForSeattleDate(mics, now, true);

  return (
    <section>
      <header className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-green-700">Open Mics Today</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-2xl font-black tracking-tight">{dayName}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatSeattleCalendarDate(now)}
          </p>
        </div>
      </header>
      {todays.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open mics listed for today.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {todays.map((mic) => (
            <ListingCard
              key={mic.id}
              mic={mic}
              isNext={nextMic !== null && mic.id === nextMic.id}
              isToday
              dayName={dayName}
            />
          ))}
        </div>
      )}
    </section>
  );
}
