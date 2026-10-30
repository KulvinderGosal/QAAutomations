import { PHASE_LABEL, PHASE_ORDER } from "@/types";
import type { Task } from "@/types";
import { PhaseAggIcon, phaseStatus } from "@/screens/taskDetail/helpers";

export function Stepper({ task }: { task: Task }) {
  const phasesWithTests = PHASE_ORDER.filter((p) => task.tests.some((t) => t.phase === p));
  if (phasesWithTests.length === 0) return null;
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-4 py-3">
      {phasesWithTests.map((p, i) => {
        const agg = phaseStatus(task, p);
        return (
          <div key={p} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1 px-1.5">
              <PhaseAggIcon agg={agg} size={17} />
              <span className="whitespace-nowrap text-[10.5px] font-medium text-ink-2">{PHASE_LABEL[p]}</span>
            </div>
            {i < phasesWithTests.length - 1 && <div className="h-px w-6 shrink-0 bg-surface-3" />}
          </div>
        );
      })}
    </div>
  );
}
