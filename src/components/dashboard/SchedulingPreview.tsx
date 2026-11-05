/** The preview for the Scheduling template. Its app does not open on the public "Coming soon" page that
 * `buildStarter` makes: the owner lands on the Admin home, so the card shows that instead — today's visits, the
 * three counts and the four business tools. Purely presentational; the card around it carries the accessible name. */
export function SchedulingPreview({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      className="relative flex h-full w-full items-end justify-center overflow-hidden"
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${color} 22%, white), color-mix(in oklab, ${color} 8%, white))` }}
    >
      <div className="relative -mb-3 h-[10.5rem] w-24 origin-bottom scale-[1.25] overflow-hidden rounded-[1.1rem] border-[3px] border-neutral-900 bg-neutral-50 shadow-xl">
        {/* The dashboard header: the app's icon, its name, and the Admin badge. */}
        <div className="flex h-5 items-center gap-1 border-b border-neutral-200 px-2">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} />
          <span className="h-1.5 w-6 rounded-full bg-neutral-900" />
          <span className="rounded-full bg-neutral-950 px-[3px] py-[2px] text-[5px] font-semibold uppercase leading-none tracking-[0.04em] text-white">
            Admin
          </span>
        </div>

        <div className="space-y-1 px-1.5 pt-1.5">
          {/* Today's visits, then the two ways to add one. */}
          <div className="rounded-[5px] bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
            <p className="text-[5px] font-semibold leading-none text-neutral-950">Today</p>
            <ul className="mt-1 divide-y divide-neutral-100">
              {VISITS.map((visit) => (
                <li key={visit.time} className="flex items-center gap-1 py-[3px] first:pt-0 last:pb-0">
                  <span className="w-5 shrink-0 text-[5px] font-semibold leading-none tabular-nums text-neutral-950">{visit.time}</span>
                  <span className="h-1 flex-1 rounded-full bg-neutral-300" />
                  <span className={`flex h-[7px] w-4 shrink-0 items-center justify-center rounded-full ${visit.pill}`}>
                    <span className={`h-[2px] w-2 rounded-full ${visit.bar}`} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex gap-1">
              <span className="h-2 flex-1 rounded-full bg-neutral-950" />
              <span className="h-2 flex-1 rounded-full bg-white ring-1 ring-neutral-300" />
            </div>
          </div>

          {/* The three status tiles under the card. */}
          <div className="grid grid-cols-3 gap-1">
            {STATUS_TILES.map((count) => (
              <div key={count} className="flex flex-col gap-0.5 rounded-[4px] bg-white p-1 ring-1 ring-black/5">
                <span className="text-[6px] font-semibold leading-none tabular-nums text-neutral-950">{count}</span>
                <span className="h-0.5 w-full rounded-full bg-neutral-300" />
              </div>
            ))}
          </div>

          {/* The four business tools, two by two. */}
          <div className="grid grid-cols-2 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-1 rounded-[4px] bg-white p-1 ring-1 ring-black/5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="h-1 flex-1 rounded-full bg-neutral-300" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const VISITS = [
  { time: "9:00", pill: "bg-cyan-100", bar: "bg-cyan-700" },
  { time: "11:30", pill: "bg-emerald-100", bar: "bg-emerald-700" },
  { time: "2:00", pill: "bg-neutral-200", bar: "bg-neutral-500" },
] as const;

const STATUS_TILES = ["24", "3", "2"] as const;
