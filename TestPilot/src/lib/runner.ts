// Client-side helpers for the local Playwright runner: fetch from our
// same-origin /api/runner/* middleware, which spawns each QA framework's own
// Playwright binary (see server/runner.ts). Types mirror the server shapes.

/** Captured-login freshness for an auth-gated framework (null = no login needed). */
export type SessionInfo = {
  required: true;
  exists: boolean;
  file: string;
  capturedAt: string | null;
  ageHours: number | null;
  ttlDays: number;
  status: "fresh" | "aging" | "stale" | "missing";
  captureCmd: string;
  dir: string;
};

export type RunnerFramework = {
  id: string;
  label: string;
  brand: "PushEngage" | "LedgerPort";
  dir: string;
  smokeArgs: string[];
  fullArgs: string[];
  projects: string[];
  envVar: string | null;
  envOptions: string[];
  defaultEnv: string | null;
  /** GitHub repo (owner/repo) for a read-only "latest commit" display, if any. */
  repo?: string | null;
  notes: string;
  healthy: boolean;
  playwrightVersion: string | null;
  problem: string | null;
  /** Captured-login freshness (auth-gated frameworks only; null otherwise). */
  session?: SessionInfo | null;
  /** I1 persona ids (`<framework>:<env>[:<name>]`); probe state via GET /api/sessions. */
  personas?: string[];
};

export type RunnerSpec = { file: string; line: number; title: string; tags: string[] };

export type NpmScript = { name: string; command: string };

export type RunMode = "spec" | "smoke" | "full" | "adhoc" | "command" | "maestro" | "ios";

export type RunFailure = { title: string; file: string; message: string };

export type RunSummary = {
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  durationMs: number;
  failures: RunFailure[];
};

// V1 honest verdict floor — mirrors server/qaLoop/verdict.ts. A run that
// executed nothing (or skipped an @case test, blew the 20% skip budget, or hit a
// qa-core BlockedError) is BLOCKED, never a pass.
export type VerdictState = "PASS" | "PASS_WITH_GAPS" | "FAIL" | "BLOCKED" | "NOT_RUN";
export type BlockedClass =
  | "SESSION"
  | "ENV"
  | "DEPLOY"
  | "FIXTURE"
  | "ORACLE"
  | "DEV"
  | "GUARDRAIL"
  | "HARNESS"
  | "DEVICE"
  | "TARGET";
export type VerdictCounts = { expected: number; unexpected: number; flaky: number; skipped: number; executed: number };
export type Verdict = {
  state: VerdictState;
  cls?: BlockedClass;
  code?: string;
  reason: string;
  humanAction?: string;
  counts: VerdictCounts;
  source: "json" | "stdout" | "exit-code" | "none";
  caseSkips?: string[];
  blockedFailures?: number;
  attempts?: number;
  firstAttempt?: { state: VerdictState; cls?: BlockedClass; reason: string };
  derivedAt?: string;
};

/** "Blocked by SESSION: <human action>" / "Passed with gaps: …" — the one-line UI string. */
export function verdictNote(v: Verdict | null | undefined): string {
  if (!v) return "";
  if (v.state === "BLOCKED") return `Blocked by ${v.cls ?? "HARNESS"}: ${v.humanAction ?? v.reason}`;
  if (v.state === "PASS_WITH_GAPS") return `Passed with gaps: ${v.reason}`;
  return v.reason;
}

/** True only for a real, honest pass: verdict PASS with at least one executed test. */
export function isHonestPass(v: Verdict | null | undefined): boolean {
  return !!v && v.state === "PASS" && v.counts.executed > 0;
}

export type RunnerRun = {
  id: string;
  framework: string;
  mode: RunMode;
  args: string[];
  env: Record<string, string>;
  status: "running" | "passed" | "failed" | "blocked" | "cancelled" | "error";
  cancelRequested: boolean;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  summary: RunSummary | null;
  /** V1 verdict — set once the run finishes (absent from older servers). */
  verdict?: Verdict | null;
  screenshot: string | null;
  /** I1: persona whose saved session the run gate checked (absent = not gated). */
  persona?: string | null;
};

export type AdhocBody = {
  title?: string;
  url: string;
  project?: string;
  env?: string;
  loginUrl?: string;
  user?: string;
  pass?: string;
  expectText?: string;
  expectTitle?: string;
  // "api" mode → adhoc/api.spec.ts (Playwright request, no browser).
  kind?: "smoke" | "api";
  method?: string;
  headers?: string; // JSON object string
  body?: string;
  expectStatus?: string;
  maxMs?: string;
  jsonPath?: string;
  jsonValue?: string;
  contains?: string;
};

// A reusable Manual Test target, persisted to localStorage. The password is
// NEVER saved (run-only) — only the non-secret form values, so you re-enter the
// password on rerun.
export type SavedTest = {
  id: string;
  name: string;
  url: string;
  env?: string;
  project?: string;
  loginUrl?: string;
  user?: string;
  expectTitle?: string;
  expectText?: string;
  savedAt: string;
};

const SAVED_KEY = "testpilot.savedTests";

export function readSavedTests(): SavedTest[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedTest[]) : [];
  } catch {
    return [];
  }
}

export function writeSavedTests(list: SavedTest[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    /* localStorage unavailable — in-memory only */
  }
}

/** Error with the HTTP status attached — 404 on a run poll means "run lost". */
export type ApiError = Error & { status?: number };

export type TaskRef = { taskId?: string; pr?: number; label?: string };

export type StartRunBody = {
  framework: string;
  mode: RunMode;
  spec?: string;
  /** For mode "command": an npm script name from the framework's package.json. */
  script?: string;
  project?: string;
  env?: string;
  /** Optional PR/task this run verifies (surfaced in Reports). */
  taskRef?: TaskRef | null;
  /** Single-case "Run": pin to the first project + no retries for fast feedback. */
  quick?: boolean;
  /** Run with a visible (headed) browser so the user can watch — TMS sets this
   *  for small selections (≤10 runnable cases); larger batches stay headless. */
  headed?: boolean;
  /** I1: false skips the pre-run session probe ("run anyway"). */
  sessionGate?: boolean;
};

async function json<T>(r: Response): Promise<T> {
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) {
    const err: ApiError = new Error(body.error || `Request failed (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return body;
}

export function fetchFrameworks(): Promise<{
  frameworks: RunnerFramework[];
  adhoc: { ready: boolean; problem: string | null };
  activeRunId: string | null;
}> {
  return fetch("/api/runner/frameworks").then((r) => json(r));
}

export function startAdhocRun(body: AdhocBody): Promise<{ run: RunnerRun }> {
  return fetch("/api/runner/adhoc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}

export function fetchSpecs(framework: string, refresh = false): Promise<{ framework: string; specs: RunnerSpec[] }> {
  return fetch(`/api/runner/specs?framework=${encodeURIComponent(framework)}${refresh ? "&refresh=1" : ""}`).then((r) =>
    json(r),
  );
}

export function fetchScripts(framework: string): Promise<{ framework: string; scripts: NpmScript[] }> {
  return fetch(`/api/runner/scripts?framework=${encodeURIComponent(framework)}`).then((r) => json(r));
}

export function startRunnerRun(body: StartRunBody): Promise<{ run: RunnerRun }> {
  return fetch("/api/runner/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}

export function fetchRun(id: string, offset: number): Promise<{ run: RunnerRun; output: string; nextOffset: number }> {
  return fetch(`/api/runner/runs/${id}?offset=${offset}`).then((r) => json(r));
}

export function cancelRunnerRun(id: string): Promise<{ run: RunnerRun }> {
  return fetch(`/api/runner/runs/${id}/cancel`, { method: "POST" }).then((r) => json(r));
}
