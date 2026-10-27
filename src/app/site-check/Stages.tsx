import type { Stage } from "seositetuneup";
import { STAGES } from "./lib/stages";
import type { StageState } from "./lib/reducer";

/** The "What it's doing" tracker: the eight stages as a vertical list, each with its name, explanation and live note. */
export function Stages({ stages }: { stages: Record<Stage, { state: StageState; note: string }> }) {
  return (
    <ol className="list-none divide-y divide-neutral-200">
      {STAGES.map((s) => {
        const st = stages[s.id];
        return (
          <li key={s.id} className="flex gap-3 px-1 py-2.5">
            <span
              aria-hidden
              className={`mt-[5px] h-3 w-3 shrink-0 rounded-full transition-colors ${
                st.state === "running"
                  ? "animate-[sc-blink_1s_ease-in-out_infinite] bg-blue-600"
                  : st.state === "done"
                    ? "bg-green-600"
                    : st.state === "skip"
                      ? "bg-neutral-400"
                      : "bg-neutral-200"
              }`}
            />
            <div className="flex min-w-0 flex-col">
              <div className="font-semibold">{s.name}</div>
              <div className="text-sm text-neutral-500">{s.why}</div>
              <div className={`min-h-[1.2em] text-sm ${st.state === "running" ? "text-blue-600" : "text-neutral-500"}`}>{st.note}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
