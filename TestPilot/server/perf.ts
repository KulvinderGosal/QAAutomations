// Lightweight single-runner HTTP load test for the dev middleware.
//
// Drives one or more target URLs at a fixed concurrency (VUs) for a duration
// using Node's global fetch, collects per-request latency + status, then computes
// latency percentiles + throughput + error rate per target ("transaction"). This
// is the local, single-engine analog of a MaxoPerf distributed load run — enough
// to measure a latency budget / SLA before shipping, without a k6/JMeter fleet.
//
// Safety: concurrency, duration and target count are hard-capped and every request
// has a timeout, so a run can't run away or hammer a host indefinitely.

export type PerfTarget = {
  name?: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type PerfTxn = {
  name: string;
  target: string;
  samples: number;
  errors: number;
  min: number;
  avg: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  rps: number;
};

export type PerfResult = {
  totalRequests: number;
  errorRate: number;
  avgMs: number;
  p95Ms: number;
  rps: number;
  durationSec: number;
  transactions: PerfTxn[];
};

const MAX_VUS = 50;
const MAX_DURATION_SEC = 120;
const MAX_TARGETS = 10;
const REQ_TIMEOUT_MS = 15_000;

function pct(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

export async function runLoadTest(input: {
  targets: PerfTarget[];
  vus: number;
  durationSec: number;
}): Promise<PerfResult> {
  const vus = Math.max(1, Math.min(MAX_VUS, Math.floor(Number(input.vus) || 1)));
  const durationSec = Math.max(1, Math.min(MAX_DURATION_SEC, Math.floor(Number(input.durationSec) || 10)));
  const targets = (input.targets || []).filter((t) => t && typeof t.url === "string" && /^https?:\/\//i.test(t.url)).slice(0, MAX_TARGETS);
  if (!targets.length) throw new Error("at least one target with an http(s) url is required");

  const endAt = Date.now() + durationSec * 1000;
  const lat: number[][] = targets.map(() => []);
  const errs: number[] = targets.map(() => 0);

  async function oneRequest(ti: number) {
    const t = targets[ti];
    const started = performance.now();
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    try {
      const res = await fetch(t.url, {
        method: (t.method || "GET").toUpperCase(),
        headers: t.headers,
        body: t.method && t.method.toUpperCase() !== "GET" && t.method.toUpperCase() !== "HEAD" ? t.body : undefined,
        signal: ctrl.signal,
      });
      await res.arrayBuffer().catch(() => {}); // drain so the request fully completes
      lat[ti].push(performance.now() - started);
      if (!res.ok) errs[ti]++;
    } catch {
      lat[ti].push(performance.now() - started);
      errs[ti]++;
    } finally {
      clearTimeout(to);
    }
  }

  // Each virtual user loops, round-robining across targets, until time is up.
  async function vuLoop(vuIndex: number) {
    let n = vuIndex;
    while (Date.now() < endAt) {
      await oneRequest(n % targets.length);
      n++;
    }
  }

  const startWall = Date.now();
  await Promise.all(Array.from({ length: vus }, (_, i) => vuLoop(i)));
  const actualSec = Math.max(0.001, (Date.now() - startWall) / 1000);

  const transactions: PerfTxn[] = targets.map((t, i) => {
    const arr = [...lat[i]].sort((a, b) => a - b);
    const samples = arr.length;
    const sum = arr.reduce((a, b) => a + b, 0);
    return {
      name: t.name || t.url,
      target: t.url,
      samples,
      errors: errs[i],
      min: samples ? arr[0] : 0,
      avg: samples ? sum / samples : 0,
      max: samples ? arr[samples - 1] : 0,
      p50: pct(arr, 50),
      p90: pct(arr, 90),
      p95: pct(arr, 95),
      p99: pct(arr, 99),
      rps: samples / actualSec,
    };
  });

  const allLat = lat.flat().sort((a, b) => a - b);
  const totalRequests = transactions.reduce((a, t) => a + t.samples, 0);
  const totalErrors = transactions.reduce((a, t) => a + t.errors, 0);
  return {
    totalRequests,
    errorRate: totalRequests ? totalErrors / totalRequests : 0,
    avgMs: allLat.length ? allLat.reduce((a, b) => a + b, 0) / allLat.length : 0,
    p95Ms: pct(allLat, 95),
    rps: totalRequests / actualSec,
    durationSec: actualSec,
    transactions,
  };
}
