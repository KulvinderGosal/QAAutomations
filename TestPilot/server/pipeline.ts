// CI/CD pipeline orchestrator.
//
// A pipeline is an ordered set of stages (Smoke → Regression → Report), each an
// npm script from the framework's package.json, run SEQUENTIALLY with
// stop-on-fail. It runs server-side through the existing one-at-a-time runner
// (so it survives client navigation, like the Scheduler) and a 3s watcher
// advances to the next stage when the current one finishes.
import { FRAMEWORKS, RunnerError, cancelRun, getRun, listScripts, startRun } from "./runner";
import type { RunSummary } from "./runner";

export type StageStatus = "pending" | "running" | "passed" | "failed" | "skipped";
export type PipelineStage = { name: string; script: string; status: StageStatus; runId: string | null; summary: RunSummary | null };
export type Pipeline = {
  id: string;
  framework: string;
  env: string | null;
  stages: PipelineStage[];
  status: "running" | "passed" | "failed" | "cancelled" | "error";
  currentStage: number;
  startedAt: string;
  finishedAt: string | null;
};

// Preferred stage order → display name; only the scripts a framework actually
// declares become stages.
const STAGE_SPEC: { name: string; script: string }[] = [
  { name: "Smoke", script: "test:smoke" },
  { name: "Regression", script: "test:regression" },
  { name: "Report", script: "test:smoke:report" },
];

/** The default pipeline stages for a framework (scripts it actually has, in order). */
export function stagesFor(frameworkId: string): { name: string; script: string }[] {
  const have = new Set(listScripts(frameworkId).map((s) => s.name));
  return STAGE_SPEC.filter((s) => have.has(s.script));
}

type PipelineInternal = Pipeline & { timer: ReturnType<typeof setInterval> | null };
const pipelines = new Map<string, PipelineInternal>();
let seq = 1;
let active: PipelineInternal | null = null;

function pub(p: PipelineInternal): Pipeline {
  const { timer: _t, ...rest } = p;
  return rest;
}

export function listPipelines(): Pipeline[] {
  return [...pipelines.values()].map(pub).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getPipeline(id: string): Pipeline {
  const p = pipelines.get(id);
  if (!p) throw new RunnerError(404, "Pipeline not found");
  return pub(p);
}

export type StartPipelineInput = { framework: string; env?: string | null };

export function startPipeline(input: StartPipelineInput): Pipeline {
  const fw = FRAMEWORKS.find((f) => f.id === input.framework);
  if (!fw) throw new RunnerError(400, `Unknown framework: ${input.framework}`);
  if (active && active.status === "running") throw new RunnerError(409, `A pipeline is already running (${active.id})`);
  const specs = stagesFor(fw.id);
  if (!specs.length) throw new RunnerError(400, `${fw.id} has no pipeline scripts (test:smoke / test:regression / test:smoke:report)`);

  const id = `pipe-${Date.now()}-${seq++}`;
  const p: PipelineInternal = {
    id,
    framework: fw.id,
    env: input.env ?? null,
    stages: specs.map((s) => ({ name: s.name, script: s.script, status: "pending", runId: null, summary: null })),
    status: "running",
    currentStage: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    timer: null,
  };
  pipelines.set(id, p);
  active = p;
  // Trim old pipelines (keep last 10).
  const ids = [...pipelines.keys()];
  while (ids.length > 10) pipelines.delete(ids.shift()!);

  startStage(p, 0);
  p.timer = setInterval(() => watch(p), 3000);
  p.timer.unref?.();
  return pub(p);
}

function startStage(p: PipelineInternal, i: number): void {
  const stage = p.stages[i];
  try {
    const run = startRun({
      framework: p.framework,
      mode: "command",
      script: stage.script,
      env: p.env ?? undefined,
      taskRef: { label: `Pipeline ${p.id.split("-").pop()} · ${stage.name}` },
    });
    stage.status = "running";
    stage.runId = run.id;
  } catch (e) {
    stage.status = "failed";
    finish(p, "error");
  }
}

function watch(p: PipelineInternal): void {
  if (p.status !== "running") {
    if (p.timer) clearInterval(p.timer);
    return;
  }
  const stage = p.stages[p.currentStage];
  if (!stage?.runId) return;
  let runStatus: string;
  let summary: RunSummary | null = null;
  try {
    const { run } = getRun(stage.runId, 0);
    runStatus = run.status;
    summary = run.summary;
  } catch {
    // Run vanished (dev server restarted) — end the pipeline.
    stage.status = "failed";
    finish(p, "error");
    return;
  }
  if (runStatus === "running") return; // keep waiting

  stage.summary = summary;
  if (runStatus === "passed") {
    stage.status = "passed";
    const next = p.currentStage + 1;
    if (next >= p.stages.length) {
      finish(p, "passed");
      return;
    }
    p.currentStage = next;
    startStage(p, next);
    return;
  }
  // failed / cancelled / error → stop the pipeline, skip the rest.
  stage.status = runStatus === "cancelled" ? "skipped" : "failed";
  for (let i = p.currentStage + 1; i < p.stages.length; i++) p.stages[i].status = "skipped";
  finish(p, runStatus === "cancelled" ? "cancelled" : "failed");
}

function finish(p: PipelineInternal, status: Pipeline["status"]): void {
  p.status = status;
  p.finishedAt = new Date().toISOString();
  if (p.timer) clearInterval(p.timer);
  p.timer = null;
  if (active?.id === p.id) active = null;
}

/** Cancel a running pipeline (cancels the in-flight stage). */
export function cancelPipeline(id: string): Pipeline {
  const p = pipelines.get(id);
  if (!p) throw new RunnerError(404, "Pipeline not found");
  if (p.status === "running") {
    const stage = p.stages[p.currentStage];
    if (stage?.runId) {
      try {
        cancelRun(stage.runId);
      } catch {
        /* already gone */
      }
    }
    for (let i = p.currentStage + 1; i < p.stages.length; i++) p.stages[i].status = "skipped";
    // The watcher will observe the cancelled run and finish; mark eagerly too.
  }
  return pub(p);
}

export function activePipelineId(): string | null {
  return active?.id ?? null;
}
