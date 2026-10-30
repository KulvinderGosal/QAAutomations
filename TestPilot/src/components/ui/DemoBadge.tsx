// "DEMO" marker for the simulated cockpit flows (useStore runTestPlan /
// simulateDevFix / the pipeline's postAsanaComment). Those run on timers against
// in-memory task data — no real runner run, no GitHub/Asana write. Real runs live
// in Test Cases (runCase) / Test Runner / Pipelines; real Asana writes are the
// confirm-gated Close task + comment routes.
export function DemoBadge({ title = "Simulated — no real test run and nothing is written to GitHub or Asana" }: { title?: string }) {
  return (
    <span
      title={title}
      className="ml-1 inline-flex items-center rounded-chip bg-warning-surface px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-warning"
    >
      Demo
    </span>
  );
}
