// Flaky-test diagnostics.
//
// DETECTION: aggregates per-test outcomes across the durable run-detail files
// (.testpilot-detail-*.json, each = one finished run with a per-test story) into
// a flaky list — a test is flaky if it both passed AND failed across runs, or a
// single run recovered it on retry (Playwright's own flaky verdict).
//
// DIAGNOSE: feeds one flaky/failed test's source + its Run Story trace (error,
// step timeline, stdout, retry) + the local pitfall catalogue to Claude and
// returns a structured root-cause + suggested fix. Reuses server/aiTest.ts's
// credential chain + 402/profile fallback, so it hits the same AI gate as the
// other AI features.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { FRAMEWORKS, getRunDetail, type RunDetail, type StoryTest } from "./runner";
import { AiError, MODEL, sendMessage, firstText, type AiCreds } from "./aiTest";
import { FLAKY_PITFALLS } from "./flakyPitfalls";

const DETAIL_PREFIX = ".testpilot-detail-";
const FAIL_STATES = new Set(["failed", "timedOut", "interrupted"]);

export type FlakyTest = {
  key: string;
  framework: string;
  spec: string | null; // "relativeFile:line" when known
  title: string;
  observations: number; // runs this test was seen in (excluding skips)
  passed: number;
  failed: number;
  retryRecoveries: number; // runs where it failed then passed on retry (Playwright flaky)
  passRate: number; // 0..1 over passed+failed
  lastStatus: string;
  lastError: string | null;
  lastRunId: string | null;
  lastAt: string | null;
};

type Agg = {
  framework: string;
  spec: string | null;
  title: string;
  passed: number;
  failed: number;
  retryRecoveries: number;
  lastAt: number;
  lastStatus: string;
  lastError: string | null;
  lastRunId: string | null;
};

/** Framework dir for a framework id (to relativise absolute spec paths). */
function fwDir(id: string): string | null {
  return FRAMEWORKS.find((f) => f.id === id)?.dir ?? null;
}

/** Relativise a (possibly absolute) Playwright test file to its framework dir. */
function relSpec(framework: string, file: string | null, line: number | null): string | null {
  if (!file) return null;
  const dir = fwDir(framework);
  let rel = file;
  if (dir && file.startsWith(dir)) rel = file.slice(dir.length).replace(/^[/\\]/, "");
  return line ? `${rel}:${line}` : rel;
}

/** Aggregate per-test outcomes across all run-detail files → the flaky list. */
export function listFlaky(): FlakyTest[] {
  const dir = process.cwd();
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.startsWith(DETAIL_PREFIX) && f.endsWith(".json"));
  } catch {
    return [];
  }
  const byKey = new Map<string, Agg>();
  for (const f of files) {
    let detail: RunDetail;
    try {
      detail = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as RunDetail;
    } catch {
      continue;
    }
    const at = new Date(detail.finishedAt || detail.startedAt || 0).getTime() || 0;
    for (const t of detail.tests ?? []) {
      const status = (t.status || "unknown").toLowerCase();
      if (status === "skipped" || status === "unknown") continue; // no signal
      // Stable identity: framework + relative spec (file:line) when known, else title.
      const spec = relSpec(detail.framework, t.file, t.line);
      const key = `${detail.framework}::${spec || t.title}`;
      let a = byKey.get(key);
      if (!a) {
        a = { framework: detail.framework, spec, title: t.title, passed: 0, failed: 0, retryRecoveries: 0, lastAt: 0, lastStatus: status, lastError: null, lastRunId: null };
        byKey.set(key, a);
      }
      const failed = FAIL_STATES.has(status);
      if (failed) a.failed++;
      else if (status === "passed") a.passed++;
      // Playwright flaky: recovered on a retry within the same run.
      if (status === "passed" && (t.retry ?? 0) > 0) a.retryRecoveries++;
      if (at >= a.lastAt) {
        a.lastAt = at;
        a.lastStatus = status;
        a.lastError = t.error ?? (failed ? "(no error captured)" : null);
        a.lastRunId = detail.id;
        a.title = t.title;
      }
    }
  }
  const out: FlakyTest[] = [];
  for (const [key, a] of byKey) {
    const mixed = a.passed > 0 && a.failed > 0;
    const isFlaky = mixed || a.retryRecoveries > 0;
    if (!isFlaky) continue;
    const denom = a.passed + a.failed;
    out.push({
      key,
      framework: a.framework,
      spec: a.spec,
      title: a.title,
      observations: denom,
      passed: a.passed,
      failed: a.failed,
      retryRecoveries: a.retryRecoveries,
      passRate: denom ? a.passed / denom : 0,
      lastStatus: a.lastStatus,
      lastError: a.lastError,
      lastRunId: a.lastRunId,
      lastAt: a.lastAt ? new Date(a.lastAt).toISOString() : null,
    });
  }
  // Flakiest first: most failures/retry-recoveries, then lowest pass rate.
  out.sort((x, y) => y.failed + y.retryRecoveries - (x.failed + x.retryRecoveries) || x.passRate - y.passRate);
  return out;
}

// ── AI diagnosis ───────────────────────────────────────────────────────────────

export type FlakyDiagnosis = {
  category: "timing" | "race-condition" | "selector" | "network" | "environment" | "auth-session" | "test-data" | "assertion" | "product-bug" | "unknown";
  matchedPitfall: string | null;
  rootCause: string;
  evidence: string;
  suggestedFix: string;
  confidence: "low" | "medium" | "high";
};

const DIAGNOSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "matchedPitfall", "rootCause", "evidence", "suggestedFix", "confidence"],
  properties: {
    category: { type: "string", enum: ["timing", "race-condition", "selector", "network", "environment", "auth-session", "test-data", "assertion", "product-bug", "unknown"] },
    matchedPitfall: { type: ["string", "null"], description: "the numbered pitfall it matches, or null" },
    rootCause: { type: "string", description: "one-paragraph most-likely cause" },
    evidence: { type: "string", description: "the specific lines/error/steps that support it" },
    suggestedFix: { type: "string", description: "concrete change (selector swap, web-first assertion, workers=1, session refresh, etc.) — include a code snippet if useful" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} as const;

/** Read the test's source (best-effort) from its framework dir + relative spec. */
function readTestSource(framework: string, spec: string | null): string | null {
  if (!spec) return null;
  const dir = fwDir(framework);
  if (!dir) return null;
  const file = spec.split(":")[0];
  // Path guard: relative, no traversal, inside the framework dir.
  if (!file || file.startsWith("/") || file.includes("..")) return null;
  const abs = path.join(dir, file);
  if (!abs.startsWith(dir) || !existsSync(abs)) return null;
  try {
    const src = readFileSync(abs, "utf8");
    return src.length > 12_000 ? src.slice(0, 12_000) + "\n… (truncated)" : src;
  } catch {
    return null;
  }
}

function findTest(detail: RunDetail, spec: string | null, title: string | null): StoryTest | null {
  const tests = detail.tests ?? [];
  if (spec) {
    const line = spec.includes(":") ? Number(spec.split(":").pop()) : null;
    const file = spec.split(":")[0];
    const hit = tests.find((t) => (t.file || "").endsWith(file) && (line ? t.line === line : true));
    if (hit) return hit;
  }
  if (title) {
    const hit = tests.find((t) => t.title === title);
    if (hit) return hit;
  }
  // Fall back to the first failed test in the run.
  return tests.find((t) => FAIL_STATES.has((t.status || "").toLowerCase())) ?? tests[0] ?? null;
}

export async function diagnoseFlaky(
  creds: AiCreds,
  input: { runId: string; spec?: string | null; title?: string | null },
): Promise<{ diagnosis: FlakyDiagnosis; test: { title: string; status: string; framework: string; spec: string | null } }> {
  const detail = getRunDetail(input.runId); // throws 404 if no story
  const t = findTest(detail, input.spec ?? null, input.title ?? null);
  if (!t) throw new AiError(400, "No test found in that run's story to diagnose.");
  const spec = input.spec ?? relSpec(detail.framework, t.file, t.line);
  const source = readTestSource(detail.framework, spec);
  const steps = t.steps
    .slice(0, 40)
    .map((s) => `${"  ".repeat(s.depth ?? 0)}- ${s.title}${s.error ? `  ✗ ${s.error}` : ""}`)
    .join("\n");
  const stdout = (t.stdout || []).slice(-25).join("\n");

  const prompt = `You are diagnosing a flaky/failing Playwright test in the PushEngage/LedgerPort QA suites. Reason about timing, race conditions, selector fragility, environment, auth/session, and test-data — decide the SINGLE most likely root cause and a concrete fix.

${FLAKY_PITFALLS}

## Framework
${detail.framework}${spec ? ` · spec ${spec}` : ""}

## Test
"${t.title}" — final status: ${t.status} (expected ${t.expected}), retry ${t.retry}

## Error
${t.error || "(none captured)"}

## Step timeline (✗ marks the failing step)
${steps || "(no steps captured)"}

## stdout tail
${stdout || "(none)"}

## Test source
${source || "(source not available — reason from the error/steps and the pitfall catalogue)"}

Return the structured diagnosis. Prefer a specific web-first-assertion / selector / workers / session fix over generic advice. If the evidence points to a real PRODUCT bug (not test flakiness), say so via category "product-bug".`;

  let res;
  try {
    res = await sendMessage(creds, {
      model: MODEL,
      max_tokens: 1200,
      output_config: { effort: "medium", format: { type: "json_schema", schema: DIAGNOSIS_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    throw e instanceof AiError ? e : new AiError(500, `Diagnosis failed: ${(e as Error).message}`);
  }
  if (res.stop_reason === "refusal") throw new AiError(422, "Claude declined to diagnose this test.");
  let diagnosis: FlakyDiagnosis;
  try {
    diagnosis = JSON.parse(firstText(res).trim()) as FlakyDiagnosis;
  } catch {
    throw new AiError(502, "Claude returned an unparseable diagnosis — try again.");
  }
  return { diagnosis, test: { title: t.title, status: t.status, framework: detail.framework, spec } };
}
