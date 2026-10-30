// Client helpers for the Reports page (/api/reports/*): persisted run history
// + the on-disk smoke reports each suite writes. Types mirror the server shapes.
import type { RunMode, RunSummary, TaskRef, Verdict } from "@/lib/runner";

export type RunHistoryEntry = {
  id: string;
  framework: string;
  mode: RunMode;
  label: string;
  status: "running" | "passed" | "failed" | "blocked" | "cancelled" | "error";
  summary: RunSummary | null;
  /** V1 verdict (absent on entries recorded before the verdict floor). */
  verdict?: Verdict | null;
  startedAt: string;
  finishedAt: string | null;
  taskRef: TaskRef | null;
};

export type SmokeReport = {
  framework: string;
  frameworkLabel: string;
  file: string; // opaque handle for the read endpoint
  name: string;
  env: string | null;
  verdict: string | null;
  taskRef: string | null;
  mtime: string;
  sizeKb: number;
};

async function json<T>(r: Response): Promise<T> {
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}

export function fetchRunHistory(): Promise<{ history: RunHistoryEntry[] }> {
  return fetch("/api/reports/history").then((r) => json(r));
}

export function fetchSmokeReports(): Promise<{ reports: SmokeReport[] }> {
  return fetch("/api/reports/smoke").then((r) => json(r));
}

export function fetchSmokeReportFile(file: string): Promise<{ name: string; html: string }> {
  return fetch(`/api/reports/smoke/file?path=${encodeURIComponent(file)}`).then((r) => json(r));
}
