// Client helpers for CI/CD pipelines (/api/pipeline/*). A pipeline runs an
// ordered smoke→regression→report set of npm scripts per product, sequentially
// with stop-on-fail, server-side. Types mirror server/pipeline.ts.
import type { RunSummary } from "@/lib/runner";

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
export type StageSpec = { name: string; script: string };

async function json<T>(r: Response): Promise<T> {
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}

export function fetchPipelines(): Promise<{ pipelines: Pipeline[] }> {
  return fetch("/api/pipeline/list").then((r) => json(r));
}
export function fetchPipeline(id: string): Promise<{ pipeline: Pipeline }> {
  return fetch(`/api/pipeline/${encodeURIComponent(id)}`).then((r) => json(r));
}
export function fetchStages(framework: string): Promise<{ framework: string; stages: StageSpec[] }> {
  return fetch(`/api/pipeline/stages?framework=${encodeURIComponent(framework)}`).then((r) => json(r));
}
export function startPipelineReq(body: { framework: string; env?: string | null }): Promise<{ pipeline: Pipeline }> {
  return fetch("/api/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}
export function cancelPipelineReq(id: string): Promise<{ pipeline: Pipeline }> {
  return fetch(`/api/pipeline/${encodeURIComponent(id)}/cancel`, { method: "POST" }).then((r) => json(r));
}
