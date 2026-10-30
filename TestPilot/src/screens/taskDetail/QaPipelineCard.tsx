import { FileText, FlaskConical, Loader2, Play, WandSparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card } from "@/components/ui/primitives";
import { QA_STAGE_LABEL, QA_STAGE_ORDER, type QaStageKey, type Task } from "@/types";
import { QaStageIcon } from "@/screens/taskDetail/QaStageIcon";

// A default all-idle rail shown before the first run so the pipeline shape is
// always visible on the task.
function idleRail(docsReady: boolean): { key: QaStageKey; status: "idle" | "done" }[] {
  return QA_STAGE_ORDER.map((key) => ({ key, status: key === "docs" && docsReady ? "done" : "idle" }));
}

export function QaPipelineCard({ task }: { task: Task }) {
  const runQaPipeline = useStore((s) => s.runQaPipeline);
  const advanceQaStage = useStore((s) => s.advanceQaStage);

  const pipeline = task.qaPipeline;
  const isAi = task.ownership === "ai";
  const docsReady = !!task.links.pullRequest;
  const running = !!pipeline?.running;
  const stages = pipeline?.stages ?? idleRail(docsReady);
  const complete = !!pipeline?.prReport;

  // First stage that hasn't finished (for the manual "run next step" affordance).
  // Falls back to the idle rail so manual stepping is reachable before any run —
  // advanceQaStage seeds a manual pipeline on the first click. Gated on the task's
  // real run state (task.run.running) so it can't double-trigger an in-flight stage.
  const nextStage = stages.find((s) => s.status === "idle" || s.status === "active" || s.status === "paused");
  const canStep = !running && !task.run.running && !complete && !!nextStage;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="m-0 text-[15px] font-semibold">Automated QA pipeline</h2>
          {task.links.pitchDoc && (
            <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <FileText size={12} /> doc-driven
            </span>
          )}
        </div>
        <Button
          variant={isAi ? "magic" : "primary"}
          size="sm"
          disabled={running}
          onClick={() => runQaPipeline(task.id)}
        >
          {running ? <Loader2 size={13} className="cp-spin" /> : isAi ? <WandSparkles size={13} /> : <FlaskConical size={13} />}
          {complete ? "Re-run pipeline" : running ? "Running…" : "Run QA pipeline"}
        </Button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto px-4 py-4">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            <div className="flex min-w-[62px] flex-col items-center gap-1 px-1.5">
              <QaStageIcon status={s.status} size={18} />
              <span className="whitespace-nowrap text-[10.5px] font-medium text-ink-2">
                {QA_STAGE_LABEL[s.key]}
              </span>
            </div>
            {i < stages.length - 1 && <div className="h-px w-5 shrink-0 bg-surface-3" />}
          </div>
        ))}
      </div>

      {canStep && nextStage && (
        <div className="flex items-center gap-2.5 border-t border-border px-4 py-2.5">
          <span className="text-[11.5px] text-muted-foreground">
            Next step: <span className="font-medium text-ink-2">{QA_STAGE_LABEL[nextStage.key]}</span>
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => advanceQaStage(task.id, nextStage.key)}>
            <Play size={12} /> Run this step
          </Button>
        </div>
      )}
    </Card>
  );
}
