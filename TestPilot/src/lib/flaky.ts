// Client for the flaky-test diagnostics API (server/flaky.ts).
import { startRunnerRun, fetchRun } from "@/lib/runner";
export type FlakyTest = {
  key: string;
  framework: string;
  spec: string | null; // "relativeFile:line"
  title: string;
  observations: number;
  passed: number;
  failed: number;
  retryRecoveries: number;
  passRate: number; // 0..1
  lastStatus: string;
  lastError: string | null;
  lastRunId: string | null;
  lastAt: string | null;
};

export type FlakyDiagnosis = {
  category:
    | "timing"
    | "race-condition"
    | "selector"
    | "network"
    | "environment"
    | "auth-session"
    | "test-data"
    | "assertion"
    | "product-bug"
    | "unknown";
  matchedPitfall: string | null;
  rootCause: string;
  evidence: string;
  suggestedFix: string;
  confidence: "low" | "medium" | "high";
};

export type DiagnoseResult = {
  diagnosis: FlakyDiagnosis;
  test: { title: string; status: string; framework: string; spec: string | null };
};

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new Error(body?.error || `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body;
}

export function fetchFlaky(): Promise<{ flaky: FlakyTest[]; aiReady: boolean }> {
  return fetch("/api/flaky/list").then((r) => json(r));
}

export function diagnoseFlaky(body: { runId: string; spec?: string | null; title?: string | null }): Promise<DiagnoseResult> {
  return fetch("/api/flaky/diagnose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}

export type RerunProgress = { done: number; passed: number; failed: number; total: number };

/**
 * Re-run one spec N times through the runner (spec mode, one browser) to CONFIRM
 * flakiness and measure a pass rate. Sequential (the runner is one-at-a-time);
 * a transient 409 (runner busy) waits + retries the same attempt a few times.
 * `control.cancelled` stops it after the current run.
 */
export async function rerunToConfirm(
  framework: string,
  spec: string,
  times: number,
  onProgress: (p: RerunProgress) => void,
  control?: { cancelled: boolean },
): Promise<RerunProgress> {
  let passed = 0;
  let failed = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < times; i++) {
    if (control?.cancelled) break;
    let runId: string | null = null;
    for (let attempt = 0; attempt < 5 && runId === null; attempt++) {
      try {
        const { run } = await startRunnerRun({
          framework,
          mode: "spec",
          spec,
          quick: true,
          taskRef: { label: `flaky re-run ${i + 1}/${times}` },
        });
        runId = run.id;
      } catch (e) {
        if ((e as { status?: number }).status === 409) {
          await sleep(2000); // runner busy — wait and retry this attempt
          continue;
        }
        throw e;
      }
    }
    if (!runId) throw new Error("Runner stayed busy — try again when no other run is active.");
    // Poll to terminal (cap ~5 min per run).
    let status = "running";
    for (let p = 0; p < 200 && status === "running"; p++) {
      await sleep(1500);
      try {
        const { run } = await fetchRun(runId, 0);
        status = run.status;
      } catch {
        /* transient — keep polling */
      }
    }
    if (status === "passed") passed++;
    else failed++; // failed / error / cancelled / stuck all count as "not a clean pass"
    onProgress({ done: i + 1, passed, failed, total: times });
  }
  return { done: passed + failed, passed, failed, total: times };
}
