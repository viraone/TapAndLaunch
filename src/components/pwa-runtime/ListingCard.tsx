import type { OpenMic } from "@/lib/listings/record";
import { buildOpenMicTimeLabel, formatMinutesToClock } from "@/lib/listings/format";

/** One open mic in a published Listing directory: the first part of StageTime's card
 * (renderOpenMicCard in its app.js): the badges, name and start time, venue, schedule,
 * time line, address, and the type, price and age badges. Travel, notes, host and the
 * action buttons come later; so does StageTime's own look. */
export function ListingCard({
  mic,
  isNext,
  isToday,
  dayName,
}: {
  mic: OpenMic;
  isNext: boolean;
  isToday: boolean;
  /** The selected day's name, for "✓ Happening this Friday!" when it isn't today. */
  dayName: string;
}) {
  const venueIsRedundant = Boolean(mic.venue) && mic.name.toLowerCase().includes(mic.venue.toLowerCase());
  const isNonWeeklyRecurring = Boolean(mic.recurrence && mic.recurrence.type !== "weekly");
  const hasMeta = Boolean(mic.micType || mic.price || mic.ageRequirement);

  return (
    <article className={`rounded-xl border p-4 ${isNext ? "border-green-600" : ""}`}>
      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-1.5">
        {isNext && (
          <span className="rounded bg-green-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            Next Open Mic
          </span>
        )}
        {isNext && isToday && (
          <span className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Happening Today
          </span>
        )}
        {isNonWeeklyRecurring && (
          <span className="rounded border border-green-600/50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-green-700">
            {isToday ? "✓ Happening tonight!" : `✓ Happening this ${dayName}!`}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <h3 className="min-w-0 text-base font-black leading-tight">{mic.name}</h3>
        <p className={`shrink-0 text-sm font-black ${isNext ? "text-green-700" : ""}`}>
          {formatMinutesToClock(mic.startMinutes) || "Time TBD"}
        </p>
      </div>
      {mic.venue && !venueIsRedundant && <p className="mt-1 text-sm font-semibold">{mic.venue}</p>}
      {mic.recurrenceText && (
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-green-700">{mic.recurrenceText}</p>
      )}
      <p className="mt-1 text-sm font-semibold text-muted-foreground">{buildOpenMicTimeLabel(mic)}</p>
      {mic.address && <p className="mt-2 text-sm">{mic.address}</p>}
      {hasMeta && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {mic.micType && (
            <span className="rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-wider">{mic.micType}</span>
          )}
          {mic.price && (
            <span className={`rounded-md border px-2.5 py-1 text-xs font-bold ${/free/i.test(mic.price) ? "text-green-700" : ""}`}>
              {mic.price}
            </span>
          )}
          {mic.ageRequirement && (
            <span className="rounded-md border px-2.5 py-1 text-xs font-semibold text-muted-foreground">{mic.ageRequirement}</span>
          )}
        </div>
      )}
    </article>
  );
}
