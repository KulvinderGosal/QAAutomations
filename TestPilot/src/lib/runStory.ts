// Client helper for the /runs/:id "Run Story" view: fetches the persisted
// per-run trace (steps + printed narrative + attachments) the story reporter
// captured. Types mirror server/runner.ts (RunDetail / StoryTest / StoryStep).
import type { RunMode, RunSummary, TaskRef, Verdict } from "@/lib/runner";

export type StoryStep = { title: string; category: string; duration: number; depth: number; error: string | null };

export type StoryAttachment = { name: string; contentType: string; dataUrl?: string };

export type StoryTest = {
  title: string;
  file: string | null;
  line: number | null;
  project: string | null;
  status: string;
  expected: string;
  durationMs: number;
  retry: number;
  steps: StoryStep[];
  stdout: string[];
  stderr: string[];
  error: string | null;
  attachments: StoryAttachment[];
};

export type RunDetail = {
  id: string;
  framework: string;
  mode: RunMode;
  label: string;
  status: "running" | "passed" | "failed" | "blocked" | "cancelled" | "error";
  summary: RunSummary | null;
  verdict?: Verdict | null;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  env: Record<string, string>;
  args: string[];
  project: string | null;
  taskRef: TaskRef | null;
  screenshot: string | null;
  outputTail: string;
  tests: StoryTest[];
};

export async function fetchRunDetail(id: string): Promise<RunDetail> {
  const r = await fetch(`/api/runner/detail?id=${encodeURIComponent(id)}`);
  const body = (await r.json().catch(() => ({}))) as { detail?: RunDetail; error?: string };
  if (!r.ok || !body.detail) throw new Error(body.error || `Request failed (${r.status})`);
  return body.detail;
}
