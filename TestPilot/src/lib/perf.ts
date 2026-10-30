// Client for the load/perf runner (server middleware `testpilot-perf-api` in
// vite.config.ts, POST /api/perf/run). Drives one or more target URLs at a set
// concurrency (VUs) for a duration and returns per-target latency percentiles +
// throughput + error rate. Single-runner "http-load" engine — the local analog of
// a MaxoPerf distributed load run.
import type { TmPerfTxn } from "@/tm/types";

export type PerfTarget = {
  name?: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type PerfRunInput = {
  label: string;
  targets: PerfTarget[];
  vus: number;
  durationSec: number;
  budgetP95Ms?: number | null;
  maxErrorRate?: number | null; // 0-1
};

export type PerfResult = {
  totalRequests: number;
  errorRate: number; // 0-1
  avgMs: number;
  p95Ms: number;
  rps: number;
  durationSec: number;
  transactions: TmPerfTxn[];
};

export async function runPerf(input: PerfRunInput): Promise<PerfResult> {
  const res = await fetch("/api/perf/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targets: input.targets,
      vus: input.vus,
      durationSec: input.durationSec,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Perf run failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as PerfResult;
}
