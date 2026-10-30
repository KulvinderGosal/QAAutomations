import { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, CircleDashed, FolderGit2, Loader2, MinusCircle, Play, RefreshCw, Square, XCircle } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Card, Chip } from "@/components/ui/primitives";
import { BRAND_TONE } from "@/lib/tone";
import { timeAgo } from "@/lib/utils";
import { RunPanel } from "@/screens/runner/RunPanel";
import type { RunnerFramework } from "@/lib/runner";
import {
  cancelPipelineReq,
  fetchPipelines,
  fetchStages,
  startPipelineReq,
  type Pipeline,
  type StageSpec,
  type StageStatus,
} from "@/lib/pipelines";

const STATUS_TONE: Record<Pipeline["status"], { label: string; color: string }> = {
  running: { label: "Running", color: "var(--emphasis)" },
  passed: { label: "Passed", color: "var(--success)" },
  failed: { label: "Failed", color: "var(--destructive)" },
  cancelled: { label: "Cancelled", color: "var(--caution)" },
  error: { label: "Error", color: "var(--destructive)" },
};

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "running") return <Loader2 size={14} className="cp-spin" style={{ color: "var(--emphasis)" }} />;
  if (status === "passed") return <CheckCircle2 size={14} style={{ color: "var(--success)" }} />;
  if (status === "failed") return <XCircle size={14} style={{ color: "var(--destructive)" }} />;
  if (status === "skipped") return <MinusCircle size={14} style={{ color: "var(--muted-foreground)" }} />;
  return <CircleDashed size={14} style={{ color: "var(--muted-foreground)" }} />;
}

export function Pipelines() {
  const frameworks = useStore((s) => s.runnerFrameworks);
  const loadRunnerFrameworks = useStore((s) => s.loadRunnerFrameworks);
  const attachRunnerRun = useStore((s) => s.attachRunnerRun);
  const brand = useStore((s) => s.brand);
  const pushToast = useStore((s) => s.pushToast);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stagesByFw, setStagesByFw] = useState<Record<string, StageSpec[]>>({});
  const [envByFw, setEnvByFw] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!frameworks) void loadRunnerFrameworks();
  }, [frameworks, loadRunnerFrameworks]);

  const refresh = () => fetchPipelines().then((r) => setPipelines(r.pipelines)).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  // Pre-load each framework's default stage shape (once).
  useEffect(() => {
    for (const fw of frameworks ?? []) {
      if (!stagesByFw[fw.id] && fw.healthy) {
        void fetchStages(fw.id).then((r) => setStagesByFw((p) => ({ ...p, [fw.id]: r.stages }))).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworks]);

  const activePipe = pipelines.find((p) => p.status === "running") ?? null;
  const anyRunning = !!activePipe;

  // Poll while a pipeline runs so stage statuses update live.
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [anyRunning]);

  // Point the RunPanel at the active pipeline's current stage run (re-attach as stages advance).
  const activeStageRunId = activePipe?.stages[activePipe.currentStage]?.runId ?? null;
  useEffect(() => {
    if (activeStageRunId) attachRunnerRun(activeStageRunId);
  }, [activeStageRunId, attachRunnerRun]);

  const visible = (frameworks ?? []).filter((f) => brand === "all" || f.brand === brand);
  const latestFor = (id: string) => pipelines.find((p) => p.framework === id) ?? null;

  const runPipeline = (fw: RunnerFramework) => {
    if (anyRunning || starting) return;
    setStarting(fw.id);
    startPipelineReq({ framework: fw.id, env: envByFw[fw.id] || fw.defaultEnv || undefined })
      .then((r) => {
        setPipelines((p) => [r.pipeline, ...p.filter((x) => x.id !== r.pipeline.id)]);
        pushToast({ icon: "generate", title: "Pipeline started", subtitle: `${fw.label} · ${r.pipeline.stages.map((s) => s.name).join(" → ")}` });
      })
      .catch((e) => pushToast({ icon: "issue", title: "Couldn't start pipeline", subtitle: (e as Error).message }))
      .finally(() => setStarting(null));
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="m-0 text-[24px] font-bold tracking-tight">Pipelines</h1>
        <p className="m-0 mt-1.5 text-[14px] text-muted-foreground">
          Run a product's whole test pipeline in one click — <b>Smoke → Regression → Report</b>, in order, stop-on-fail.
          Stages run locally with each framework's own Playwright, streaming below. The header tab scopes this list by
          brand.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        {(frameworks ?? []).length === 0 && (
          <Card className="col-span-2 flex items-center justify-center gap-2 p-8 text-[13px] text-muted-foreground">
            <Loader2 size={15} className="cp-spin" /> Checking frameworks…
          </Card>
        )}
        {visible.map((fw) => {
          const brandTone = BRAND_TONE[fw.brand];
          const pipe = latestFor(fw.id);
          const stages = pipe ? pipe.stages : (stagesByFw[fw.id] ?? []).map((s) => ({ ...s, status: "pending" as StageStatus, runId: null, summary: null }));
          const isThisRunning = pipe?.status === "running";
          return (
            <Card key={fw.id} className="overflow-hidden p-4">
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: brandTone.surface, color: brandTone.color }}>
                  <FolderGit2 size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-ink-1">{fw.label}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${fw.healthy ? "bg-success" : "bg-warning"}`} title={fw.problem ?? "Ready"} />
                  </div>
                  <div className="mt-1">
                    <Chip tone={brandTone}>{fw.brand}</Chip>
                    {pipe && (
                      <span className="ml-2 text-[11px] font-medium" style={{ color: STATUS_TONE[pipe.status].color }}>
                        {STATUS_TONE[pipe.status].label}
                        {pipe.finishedAt ? ` · ${timeAgo(pipe.finishedAt)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                {fw.envVar && (
                  <select
                    value={envByFw[fw.id] ?? fw.defaultEnv ?? ""}
                    onChange={(e) => setEnvByFw((p) => ({ ...p, [fw.id]: e.target.value }))}
                    disabled={isThisRunning}
                    className="rounded-control border border-border bg-card px-2 py-1 text-[11.5px] text-ink-1 outline-none"
                    title={fw.envVar}
                  >
                    {fw.envOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                )}
                {isThisRunning ? (
                  <Button size="sm" variant="destructive" onClick={() => void cancelPipelineReq(pipe!.id).then(refresh)}>
                    <Square size={12} /> Cancel
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!fw.healthy || anyRunning || starting === fw.id || stages.length === 0}
                    onClick={() => runPipeline(fw)}
                    title={anyRunning ? "A pipeline is already running (one at a time)" : "Run this product's pipeline"}
                  >
                    {starting === fw.id ? <Loader2 size={12} className="cp-spin" /> : <Play size={12} />} Run pipeline
                  </Button>
                )}
              </div>

              {/* Stage tracker */}
              {stages.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                  {stages.map((s, i) => (
                    <span key={s.name} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight size={13} className="text-muted-foreground" />}
                      <span
                        className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface-1 px-2 py-1 text-[11.5px] font-medium text-ink-2"
                        title={s.summary ? `${s.summary.expected} passed · ${s.summary.unexpected} failed` : s.status}
                      >
                        <StageIcon status={s.status} />
                        {s.name}
                        {s.summary && (s.summary.expected > 0 || s.summary.unexpected > 0) && (
                          <span className="text-[10px] text-muted-foreground">
                            {s.summary.expected}✓{s.summary.unexpected ? `/${s.summary.unexpected}✗` : ""}
                          </span>
                        )}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-3 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
                  {fw.healthy ? "No pipeline scripts (test:smoke / test:regression / test:smoke:report)." : fw.problem}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Live output of the running stage */}
      <RunPanel />
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <RefreshCw size={12} /> Pipelines run server-side (one at a time) and survive navigation — come back any time to
        watch progress. Schedule them from the Scheduler; results land in Reports.
      </p>
    </div>
  );
}
