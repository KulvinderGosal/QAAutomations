// ── Test-management model (ported from TestCollab) ───────────────────────────
// TestPilot's primary domain: Suites → Test Cases, Test Plans → Test Runs, plus
// Requirements / Risks / Releases / Defects. Everything persists to localStorage
// (browser-only, like the rest of TestPilot — no backend). The key advantage
// over a generic TMS: an "automated" case links to one of the local Playwright
// frameworks and executes through TestPilot's own runner, writing the result
// back onto the case.
import type { Tone } from "@/lib/tone";

export type TmPriority = "low" | "normal" | "high" | "critical";
export type TmAutomation = "manual" | "automated";
export type TmReview = "draft" | "pending" | "approved";
export type TmRunStatus = "unexecuted" | "passed" | "failed" | "skipped" | "blocked";
// The kind of scenario a case exercises — drives edge/negative coverage reporting
// (a Phase-3 QA best practice). Optional so existing cases hydrate untouched.
export type TmCaseType = "positive" | "negative" | "edge" | "boundary";

export type TmStep = { step: string; expected: string };
export type TmComment = { id: string; author: string; body: string; at: string };
export type TmHistoryEntry = {
  id: string;
  status: TmRunStatus;
  at: string;
  by: string;
  runId?: string;
  note?: string;
  /** Screenshot (data URL) captured by an on-device run, if any. */
  screenshot?: string | null;
};

// A saved on-device run report (single case or a bulk "Run selected"). Persisted
// so every device run keeps its result + screenshots (passed ones especially).
export type TmDeviceRunResult = {
  caseId: string;
  key: string;
  title: string;
  status: TmRunStatus;
  screenshot?: string | null;
};
export type TmDeviceRun = {
  id: string;
  at: string;
  by: string;
  label: string; // e.g. "IAM iOS · 5 cases" / "IAM-TRIG-01"
  total: number;
  passed: number;
  failed: number;
  results: TmDeviceRunResult[];
};

// A folder in the suite tree. `productId` links a suite to a TestPilot product
// so automated cases default to that product's framework.
export type TmSuite = {
  id: string;
  name: string;
  parentId: string | null; // null = top-level
  productId?: string | null;
  order: number;
};

/** Link from a TM case to its source ticket (V2a Asana intake). `caseKey` is the
 *  ^[A-Z]{2,6}(-[A-Z0-9]+)+ key from the subtask title (e.g. SL-T1-01), or null. */
export type TmExternalRef = {
  system: "asana";
  gid: string;
  parentGid: string;
  caseKey: string | null;
  url?: string;
  /** The subtask's Asana completion at the last import (informational only). */
  completed?: boolean;
  syncedAt?: string;
};

export type TmCase = {
  id: string; // internal id
  key: string; // "TC-12" display key
  title: string;
  description: string;
  suiteId: string;
  priority: TmPriority;
  automation: TmAutomation;
  steps: TmStep[];
  tags: string[];
  review: TmReview;
  /** Scenario kind (positive/negative/edge/boundary) — optional; drives coverage. */
  caseType?: TmCaseType;
  /** Requirements this case verifies — the case→requirement half of a two-way
   *  traceability link (the requirement→case half lives on TmRequirement.caseIds). */
  requirementIds?: string[];
  // Automation link (used when automation === "automated")
  frameworkId?: string | null;
  specFile?: string | null;
  // Execution rollup
  lastRunStatus: TmRunStatus;
  lastRunAt?: string | null;
  runs: number;
  // Provenance
  source: "manual" | "copilot" | "seed" | "asana";
  /** V2a: where this case came from outside TestPilot (an Asana subtask). The
   *  Asana import upserts by externalRef.gid; Playwright specs tagged
   *  `@case:<caseKey>` bind to the case with that caseKey on framework import. */
  externalRef?: TmExternalRef;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  comments: TmComment[];
  history: TmHistoryEntry[];
};

export type TmPlanStatus = "active" | "completed" | "archived";
export type TmPlan = {
  id: string;
  key: string;
  title: string;
  caseIds: string[];
  releaseId?: string | null;
  priority: TmPriority;
  status: TmPlanStatus;
  assignedTo?: string | null; // AppUser id
  createdBy: string;
  createdAt: string;
  // Set when the plan was generated from a GitHub PR (Test Plans PR builder).
  prUrl?: string | null;
  prRepo?: string | null;
  prNumber?: number | null;
};

// A per-case result recorded during a plan run.
export type TmExecution = {
  id: string;
  planId: string;
  caseId: string;
  status: TmRunStatus;
  note?: string;
  timeSpentSec?: number;
  defectId?: string | null;
  runId?: string | null; // a runner run id when executed via automation
  executedBy: string;
  executedAt: string;
};

export type TmRequirement = {
  id: string;
  key: string;
  title: string;
  description: string;
  caseIds: string[];
  createdAt: string;
};

export type TmRiskStatus = "open" | "mitigated" | "accepted" | "closed";
export type TmRisk = {
  id: string;
  key: string;
  title: string;
  description: string;
  likelihood: number; // 1-5
  impact: number; // 1-5
  caseIds: string[];
  defectIds: string[];
  status: TmRiskStatus;
  createdAt: string;
};

export type TmReleaseStatus = "planned" | "in-progress" | "released";
// One exit-criterion in a release's GO/NO-GO gate (checklist the team ticks off).
export type TmGateCriterion = { id: string; label: string; met: boolean };
export type TmSignOffDecision = "go" | "no-go";
export type TmRelease = {
  id: string;
  name: string;
  date?: string | null;
  status: TmReleaseStatus;
  createdAt: string;
  /** Scope / entry-criteria notes for the release (free text). */
  entryCriteria?: string;
  /** Exit-criteria checklist that the GO/NO-GO decision hangs on. */
  gateCriteria?: TmGateCriterion[];
  /** Final release sign-off; null/absent until someone decides GO or NO-GO. */
  signOff?: { by: string; at: string; decision: TmSignOffDecision; note?: string } | null;
};

// ── Performance / load testing (modeled on a MaxoPerf load run) ──────────────
// A perf run = a target driven at a set concurrency for a duration; per-endpoint
// "transactions" carry latency percentiles + throughput + error rate, and the run
// passes/fails against a p95 latency budget + max error-rate gate.
export type TmPerfStatus = "running" | "passed" | "failed" | "error";
export type TmPerfTxn = {
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
export type TmPerfRun = {
  id: string;
  label: string;
  engine: string; // load engine (single-runner "http-load" today; MaxoPerf = distributed runners)
  location: string; // where load was generated from ("local")
  vus: number; // concurrent virtual users
  durationSec: number;
  status: TmPerfStatus;
  startedAt: string;
  finishedAt?: string | null;
  // headline metrics (aggregate across transactions)
  totalRequests: number;
  errorRate: number; // 0-1
  avgMs: number;
  p95Ms: number;
  rps: number;
  // per-endpoint breakdown (MaxoPerf "transactions")
  transactions: TmPerfTxn[];
  // latency-budget / SLA gate
  budgetP95Ms?: number | null;
  maxErrorRate?: number | null; // 0-1
  gateReason?: string | null;
  createdBy: string;
};

export type TmDefectSeverity = "low" | "medium" | "high" | "critical";
export type TmDefectStatus = "open" | "in-progress" | "resolved" | "closed";
export type TmDefect = {
  id: string;
  key: string;
  title: string;
  description: string;
  severity: TmDefectSeverity;
  status: TmDefectStatus;
  caseId?: string | null;
  executionId?: string | null;
  /** Requirement this defect traces back to (optional) — extends the RTM chain. */
  requirementId?: string | null;
  github?: { repo: string; number: number; url: string } | null;
  createdBy: string;
  createdAt: string;
  /** Set when status moves to resolved/closed — unlocks resolution-time metrics. */
  resolvedAt?: string | null;
  /** True when the defect was found after release (production escape) — feeds the
   *  defect-leakage / escape-rate KPI. */
  escaped?: boolean;
};

export type TmActivity = {
  id: string;
  at: string;
  by: string;
  icon: "case" | "run" | "plan" | "defect" | "copilot" | "suite" | "requirement" | "risk" | "release";
  html: string;
};

// ── Enums, labels, tones ─────────────────────────────────────────────────────

export const TM_PRIORITY_LABEL: Record<TmPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

export const TM_PRIORITY_TONE: Record<TmPriority, Tone> = {
  low: { label: "Low", color: "var(--muted-foreground)", surface: "oklch(0.96 0 0)" },
  normal: { label: "Normal", color: "var(--info)", surface: "var(--info-surface)" },
  high: { label: "High", color: "var(--caution)", surface: "var(--caution-surface)" },
  critical: { label: "Critical", color: "var(--destructive)", surface: "var(--destructive-surface)" },
};

export const TM_RUN_STATUS_LABEL: Record<TmRunStatus, string> = {
  unexecuted: "Unexecuted",
  passed: "Passed",
  failed: "Failed",
  skipped: "Skipped",
  blocked: "Blocked",
};

export const TM_RUN_STATUS_TONE: Record<TmRunStatus, Tone> = {
  unexecuted: { label: "Unexecuted", color: "var(--muted-foreground)", surface: "oklch(0.96 0 0)" },
  passed: { label: "Passed", color: "var(--success)", surface: "var(--success-surface)" },
  failed: { label: "Failed", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  skipped: { label: "Skipped", color: "var(--caution)", surface: "var(--caution-surface)" },
  blocked: { label: "Blocked", color: "var(--emphasis)", surface: "var(--emphasis-surface)" },
};

// Chart colors for the dashboard status timeline (dataviz categorical order).
export const TM_RUN_STATUS_COLOR: Record<Exclude<TmRunStatus, "unexecuted">, string> = {
  passed: "var(--success)",
  failed: "var(--destructive)",
  skipped: "var(--caution)",
  blocked: "var(--emphasis)",
};

export const TM_REVIEW_LABEL: Record<TmReview, string> = {
  draft: "Draft",
  pending: "Review pending",
  approved: "Approved",
};

export const TM_PLAN_STATUS_LABEL: Record<TmPlanStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

export const TM_DEFECT_SEVERITY_TONE: Record<TmDefectSeverity, Tone> = {
  low: { label: "Low", color: "var(--muted-foreground)", surface: "oklch(0.96 0 0)" },
  medium: { label: "Medium", color: "var(--caution)", surface: "var(--caution-surface)" },
  high: { label: "High", color: "var(--warning)", surface: "var(--warning-surface)" },
  critical: { label: "Critical", color: "var(--destructive)", surface: "var(--destructive-surface)" },
};

export const TM_CASE_TYPE_LABEL: Record<TmCaseType, string> = {
  positive: "Positive",
  negative: "Negative",
  edge: "Edge",
  boundary: "Boundary",
};

export const TM_CASE_TYPE_TONE: Record<TmCaseType, Tone> = {
  positive: { label: "Positive", color: "var(--success)", surface: "var(--success-surface)" },
  negative: { label: "Negative", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  edge: { label: "Edge", color: "var(--caution)", surface: "var(--caution-surface)" },
  boundary: { label: "Boundary", color: "var(--emphasis)", surface: "var(--emphasis-surface)" },
};

export const TM_PERF_STATUS_TONE: Record<TmPerfStatus, Tone> = {
  running: { label: "Running", color: "var(--info)", surface: "var(--info-surface)" },
  passed: { label: "Passed", color: "var(--success)", surface: "var(--success-surface)" },
  failed: { label: "Failed", color: "var(--destructive)", surface: "var(--destructive-surface)" },
  error: { label: "Error", color: "var(--emphasis)", surface: "var(--emphasis-surface)" },
};

// The 8 local Playwright frameworks an automated case can bind to (mirrors
// server/runner.ts FRAMEWORKS — kept as a static list so the case editor works
// without a runner round-trip).
export const TM_FRAMEWORKS: { id: string; label: string; brand: "PushEngage" | "LedgerPort" }[] = [
  { id: "pushengage-site", label: "PushEngage Marketing Site", brand: "PushEngage" },
  { id: "pushengage-app-dashboard", label: "PushEngage App Dashboard", brand: "PushEngage" },
  { id: "pushengage-shopify-revamped", label: "PushEngage Shopify", brand: "PushEngage" },
  { id: "pushengage-wp-plugin", label: "PushEngage WP Plugin", brand: "PushEngage" },
  { id: "ledgerport-saas-automation", label: "LedgerPort SaaS", brand: "LedgerPort" },
  { id: "ledgerport-wp-plugin", label: "LedgerPort WP Plugin", brand: "LedgerPort" },
  { id: "ledgerport-shopify", label: "LedgerPort Shopify", brand: "LedgerPort" },
  { id: "ledgerport-marketing-site", label: "LedgerPort Marketing Site", brand: "LedgerPort" },
];

export function riskScore(r: Pick<TmRisk, "likelihood" | "impact">): number {
  return r.likelihood * r.impact;
}

export function riskBand(score: number): { label: string; tone: Tone } {
  if (score >= 15) return { label: "Critical", tone: { label: "Critical", color: "var(--destructive)", surface: "var(--destructive-surface)" } };
  if (score >= 8) return { label: "High", tone: { label: "High", color: "var(--warning)", surface: "var(--warning-surface)" } };
  if (score >= 4) return { label: "Medium", tone: { label: "Medium", color: "var(--caution)", surface: "var(--caution-surface)" } };
  return { label: "Low", tone: { label: "Low", color: "var(--muted-foreground)", surface: "oklch(0.96 0 0)" } };
}
