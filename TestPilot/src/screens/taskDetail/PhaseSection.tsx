import { PHASE_LABEL, type Phase, type Task } from "@/types";
import { PHASE_AGG_COLOR, PhaseAggIcon, phaseStatus, phaseTests } from "@/screens/taskDetail/helpers";
import { TestRow } from "@/screens/taskDetail/TestRow";

export function PhaseSection({ task, phase }: { task: Task; phase: Phase }) {
  const tests = phaseTests(task, phase);
  if (tests.length === 0) return null;
  const agg = phaseStatus(task, phase);
  const passed = tests.filter((t) => t.status === "passed").length;

  const statusText =
    agg === "passed"
      ? `${passed} passed`
      : agg === "failed"
        ? "Failed"
        : agg === "running"
          ? "Running"
          : agg === "blocked"
            ? "Blocked"
            : "Queued";

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2.5 bg-surface-1 px-4 py-2">
        <PhaseAggIcon agg={agg} size={14} />
        <span className="text-[12.5px] font-semibold text-ink-2">{PHASE_LABEL[phase]}</span>
        <span className="text-[11.5px] font-medium" style={{ color: PHASE_AGG_COLOR[agg] }}>
          {statusText}
        </span>
      </div>
      {tests.map((t) => (
        <TestRow key={t.id} task={task} test={t} />
      ))}
    </div>
  );
}
