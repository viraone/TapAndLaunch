"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** The first-run list at the top of the page. The picker only reaches the first two; the rest happen in the builder. */
const STEPS = ["Choose a start", "Name it", "Make it yours", "Publish and share"] as const;

const FlowContext = createContext<{ stage: number; setStage: (stage: number) => void }>({ stage: 0, setStage: () => {} });

/** Holds which step the person is on, so the list in the page header and the picker below it agree. */
export function FlowProgressProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState(0);
  return <FlowContext.Provider value={{ stage, setStage }}>{children}</FlowContext.Provider>;
}

/** The picker calls this with the stage its current screen belongs to (0 = choosing, 1 = about and name). */
export function useSetFlowStage(): (stage: number) => void {
  return useContext(FlowContext).setStage;
}

export function FirstRunSteps() {
  const { stage } = useContext(FlowContext);
  return (
    <ol className="mt-6 flex flex-wrap gap-2 text-xs font-medium" aria-label="Your first app, in four steps">
      {STEPS.map((label, i) => {
        const current = i === stage;
        const done = i < stage;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 ${current ? "bg-neutral-950 text-white ring-neutral-950" : done ? "bg-white text-neutral-950 ring-neutral-400" : "bg-white text-neutral-600 ring-neutral-200"}`}
          >
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${current ? "bg-white text-neutral-950" : "bg-neutral-100 text-neutral-600"}`}>{done ? "✓" : i + 1}</span>
            {label}
            {done && <span className="sr-only"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
}
