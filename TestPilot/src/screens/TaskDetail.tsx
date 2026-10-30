import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Calendar,
  Check,
  FilePlus2,
  FileText,
  FlaskConical,
  FolderOpen,
  Loader2,
  UserCheck,
  WandSparkles,
  X,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { ProductChip } from "@/components/ProductChip";
import { OWNERSHIP_TONE, TASK_STATUS_TONE } from "@/lib/tone";
import { daysInQALabel } from "@/lib/taskUi";
import { Button, Card, Chip, EyebrowLabel, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";
import { PHASE_ORDER } from "@/types";
import { Stepper } from "@/screens/taskDetail/Stepper";
import { QaAuthoringCard } from "@/screens/taskDetail/QaAuthoringCard";
import { PhaseSection } from "@/screens/taskDetail/PhaseSection";
import { BrowserMatrix } from "@/screens/taskDetail/BrowserMatrix";
import { OutcomeCard } from "@/screens/taskDetail/OutcomeCard";
import { TaskRunnerCard } from "@/screens/taskDetail/TaskRunnerCard";
import { RightColumn } from "@/screens/taskDetail/RightColumn";
import { QaPipelineCard } from "@/screens/taskDetail/QaPipelineCard";
import { PrReportCard } from "@/screens/taskDetail/PrReportCard";
import { BugsForPr } from "@/screens/taskDetail/BugsForPr";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AsanaCommentCard } from "@/screens/taskDetail/AsanaCommentCard";
import { AsanaOriginBadge } from "@/components/AsanaOriginBadge";
import { GithubOriginBadge } from "@/components/GithubOriginBadge";
import { SlackOriginBadge } from "@/components/SlackOriginBadge";
import { DemoBadge } from "@/components/ui/DemoBadge";

export function TaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const runTestPlan = useStore((s) => s.runTestPlan);
  const scaffoldTests = useStore((s) => s.scaffoldTests);
  const generateFromTask = useStore((s) => s.generateFromTask);
  const openEditor = useStore((s) => s.openEditor);
  const claimTask = useStore((s) => s.claimTask);
  const releaseTask = useStore((s) => s.releaseTask);
  const closeTask = useStore((s) => s.closeTask);
  const [confirmClose, setConfirmClose] = useState(false);

  if (!task) {
    return (
      <div className="py-16 text-center text-[14px] text-muted-foreground">
        Task not found. <button className="text-primary hover:underline" onClick={() => navigate("/queue")}>Back to queue</button>
      </div>
    );
  }

  const tone = TASK_STATUS_TONE[task.status];
  const hasTests = task.tests.length > 0;

  return (
    <div>
      <button
        onClick={() => navigate("/queue")}
        className="mb-3.5 flex items-center gap-1.5 border-none bg-none text-[13px] font-medium text-muted-foreground hover:underline"
      >
        <ArrowLeft size={15} /> Back to queue
      </button>

      <div className="mb-5 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <ProductChip productId={task.productId} />
            <StatusBadge tone={tone}>{tone.label}</StatusBadge>
            <Chip tone={{ color: "var(--muted-foreground)", surface: "oklch(0.95 0 0)" }} icon={<Calendar size={11} />}>
              {daysInQALabel(task)}
            </Chip>
            {task.origin === "asana" && <AsanaOriginBadge link={task.asana} asLink showExternal />}
            {task.origin === "github" && <GithubOriginBadge link={task.github} asLink showExternal />}
            {task.origin === "slack" && <SlackOriginBadge link={task.slack} asLink showExternal />}
          </div>
          <h1 className="m-0 text-[23px] font-bold leading-tight tracking-tight">{task.title}</h1>
        </div>
        {task.status === "verified" && (
          <Button variant="primary" className="shrink-0" onClick={() => setConfirmClose(true)}>
            <Check size={15} /> Close task
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close task"
        confirmLabel="Close task"
        message={
          task.origin === "asana" ? (
            <>
              Mark <b className="font-semibold text-ink-1">{task.title}</b> as <b>Verified &amp; closed</b> — and mark it
              complete in <b>Asana</b>? This performs a real update on the Asana task (reversible in Asana).
            </>
          ) : (
            <>
              Mark <b className="font-semibold text-ink-1">{task.title}</b> as <b>Verified &amp; closed</b>?
            </>
          )
        }
        onConfirm={() => {
          void closeTask(task.id);
        }}
      />

      <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] items-start gap-[18px]">
        <div className="flex flex-col gap-[18px]">
          <Card className="p-[18px]">
            <p className="m-0 text-[13.5px] leading-[1.55] text-ink-2">{task.description}</p>
            {task.acceptanceCriteria && (
              <div className="mt-3 rounded-control bg-surface-2 px-3.5 py-3">
                <EyebrowLabel className="mb-1">Acceptance criteria</EyebrowLabel>
                <p className="m-0 text-[13px] leading-[1.5] text-ink-2">{task.acceptanceCriteria}</p>
              </div>
            )}
            <div className="mt-3.5 grid grid-cols-4 gap-3 border-t border-border pt-3.5">
              <Field label="Type" value={task.type} />
              <Field label="Priority" value={task.priority} />
              <Field label="Branch" value={task.branch} mono />
              <Field label="Environment" value={task.environment} />
            </div>
          </Card>

          {task.origin === "github" && <BugsForPr task={task} />}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-3.5">
              <div className="flex items-center gap-2.5">
                <EyebrowLabel>Ownership</EyebrowLabel>
                {task.ownership === "unclaimed" ? (
                  <span className="text-[12.5px] text-muted-foreground">Nobody's picked this up yet</span>
                ) : (
                  <Chip tone={OWNERSHIP_TONE[task.ownership]}>
                    {OWNERSHIP_TONE[task.ownership].label}
                    {task.pickedUpAt ? ` · since ${timeAgo(task.pickedUpAt)}` : ""}
                  </Chip>
                )}
              </div>
              {task.ownership === "unclaimed" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => claimTask(task.id, "human")}>
                    <UserCheck size={13} /> Take it
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => claimTask(task.id, "ai")}>
                    <Bot size={13} /> Hand to AI
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => releaseTask(task.id)}>
                  <X size={13} /> Release
                </Button>
              )}
            </div>
          </Card>

          <QaAuthoringCard task={task} />

          <QaPipelineCard task={task} />

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
              <h2 className="m-0 text-[15px] font-semibold">Playwright test cases</h2>
              {hasTests && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditor(task.id)}>
                    <FileText size={13} /> Edit specs
                  </Button>
                  <Button variant="primary" size="sm" disabled={task.run.running} onClick={() => runTestPlan(task.id)}>
                    {task.run.running ? <Loader2 size={13} className="cp-spin" /> : <FlaskConical size={13} />}
                    Run tests <DemoBadge />
                  </Button>
                </div>
              )}
            </div>

            {!hasTests ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <FileText size={26} style={{ color: "var(--warning)" }} />
                <div className="text-[13.5px] font-medium text-ink-2">No tests authored for this task yet</div>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => scaffoldTests(task.id)}>
                    <FilePlus2 size={13} /> Scaffold test suite
                  </Button>
                  <Button variant="magic" size="sm" onClick={() => generateFromTask(task.id)}>
                    <WandSparkles size={13} /> Generate from task
                  </Button>
                  <Button variant="outline" size="sm">
                    <FolderOpen size={13} /> Open spec folder
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {task.run.running && (
                  <div className="border-b border-border px-[18px] py-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={12} className="cp-spin" /> Running test plan…
                      </span>
                      <span>{task.run.progress}%</span>
                    </div>
                    <ProgressBar value={task.run.progress} striped tone="var(--emphasis)" />
                  </div>
                )}
                <Stepper task={task} />
                <div className="border-t border-border">
                  {PHASE_ORDER.map((p) => (
                    <PhaseSection key={p} task={task} phase={p} />
                  ))}
                </div>
              </>
            )}
          </Card>

          <BrowserMatrix task={task} />
          <TaskRunnerCard task={task} />
          <OutcomeCard task={task} />
          <PrReportCard task={task} />
          <AsanaCommentCard task={task} />
        </div>

        <RightColumn task={task} />
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <EyebrowLabel className="mb-1">{label}</EyebrowLabel>
      <div className={`truncate text-[12.5px] font-medium text-ink-1 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
