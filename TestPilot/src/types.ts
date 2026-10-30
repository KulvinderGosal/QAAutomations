export type Brand = "PushEngage" | "LedgerPort";
export type BrandFilter = "all" | Brand;

export type Phase =
  | "ui"
  | "unit"
  | "functional"
  | "smoke"
  | "a11y"
  | "perf"
  | "regression";

export const PHASE_ORDER: Phase[] = [
  "ui",
  "unit",
  "functional",
  "smoke",
  "a11y",
  "perf",
  "regression",
];

export const PHASE_LABEL: Record<Phase, string> = {
  ui: "UI & style",
  unit: "Unit",
  functional: "Functional",
  smoke: "Smoke",
  a11y: "Accessibility",
  perf: "Performance",
  regression: "Regression",
};

export type TestStatus = "queued" | "running" | "passed" | "failed" | "blocked";

export type TestCase = {
  id: string;
  name: string;
  file: string;
  phase: Phase;
  tag?: string;
  status: TestStatus;
  flaky?: boolean;
  history: ("pass" | "fail")[];
  retries?: number;
  error?: {
    matcher: string;
    message: string;
    locator: string;
    expected: string;
    received: string;
    stack: string;
  };
};

export type TaskStatus =
  | "assigned"
  | "tests-missing"
  | "ready"
  | "running"
  | "passed"
  | "verified"
  | "failed"
  | "reported"
  | "verifying"
  | "accepted"
  | "closed";

export type Priority = "High" | "Medium" | "Low";

export type TaskOrigin = "asana" | "manual" | "github" | "slack";

export type AsanaLink = {
  gid: string;
  url: string;
  project: string;
  completed?: boolean;
};

export type SlackLink = {
  channel: string; // "#qa-automation"
  channelId: string;
  ts: string; // message timestamp id
  permalink: string;
  author: string; // who posted the assignment
};

export type GithubLink = {
  repo: string; // "owner/repo"
  number: number;
  url: string;
  state?: string;
  labels?: string[];
  comments?: number;
  assignee?: string | null; // GitHub login the issue is assigned to
  creator?: string | null; // GitHub login that opened it
  // The dev's most recent comment on the issue (their fix note / response).
  // Its presence enables the "Verify fix" CTA in the QA Queue.
  devComment?: { login: string; body: string; at: string } | null;
};

// ── GitHub issue "Verify fix" workflow ────────────────────────────────────────
// When a dev comments a fix on a GitHub issue, QA runs the product smoke to
// verify it, and on a pass posts "verified & validated" + closes the issue
// (both REAL GitHub writes, confirm-gated). This tracks that flow per task.
export type FixVerification = {
  /** "blocked" (V1): the verify run produced no honest verdict (0 executed /
   *  skips / gaps / a qa-core BlockedError) — the issue is NOT closed. */
  state: "idle" | "running" | "passed" | "failed" | "blocked" | "closed";
  /** Why the last verify run was blocked / had gaps ("Blocked by SESSION: …"). */
  note?: string;
  runId?: string;
  startedAt?: string;
  finishedAt?: string;
  commentUrl?: string; // the closing comment posted back to GitHub
};

export type ActivityEvent = {
  id: string;
  icon: "assign" | "run" | "comment" | "issue" | "check" | "merge" | "flag" | "claim";
  html: string;
  at: string;
};

export type TaskRun = {
  running: boolean;
  progress: number; // 0-100
  currentTestId: string | null;
};

export type Ownership = "unclaimed" | "human" | "ai";

export type TestArtifacts = {
  plan: boolean;
  scenarios: boolean;
  cases: boolean;
};

// ── AI QA authoring (Plan → Scenarios → Playwright cases → Excel record) ─────
// Claude reads the assigned task and authors a real QA plan: which areas to
// test + environment (TestPlan), the corner-case scenarios (TestScenario[]),
// and real Playwright specs written into the framework's ai-generated/ folder.
// A durable Excel record is exported for every authored task. See
// server/qaPlanner.ts + src/lib/qaPlanner.ts.
export type TestArea =
  | "ui"
  | "unit"
  | "functional"
  | "cross-browser"
  | "responsive"
  | "a11y"
  | "perf"
  | "regression";

export const TEST_AREA_LABEL: Record<TestArea, string> = {
  ui: "UI & style",
  unit: "Unit",
  functional: "Functional",
  "cross-browser": "Cross-browser",
  responsive: "Mobile / responsive",
  a11y: "Accessibility",
  perf: "Performance",
  regression: "Regression",
};

export type PlanArea = {
  area: TestArea;
  inScope: boolean;
  priority: Priority;
  rationale: string;
};

export type TestPlan = {
  summary: string;
  environment: string;
  frameworkId: string;
  areas: PlanArea[];
  browsers: string[];
  viewports: string[];
  risks: string[];
};

export type ScenarioType =
  | "happy-path"
  | "negative"
  | "boundary"
  | "edge"
  | "error"
  | "security"
  | "a11y"
  | "responsive";

export const SCENARIO_TYPE_LABEL: Record<ScenarioType, string> = {
  "happy-path": "Happy path",
  negative: "Negative",
  boundary: "Boundary",
  edge: "Edge case",
  error: "Error handling",
  security: "Security",
  a11y: "Accessibility",
  responsive: "Responsive",
};

export type TestScenario = {
  id: string;
  title: string;
  area: TestArea;
  type: ScenarioType;
  priority: Priority;
  steps: string[];
  expected: string;
};

export type GeneratedSpec = {
  filename: string;
  savedPath?: string;
};

export type QaAuthoringStatus =
  | "idle"
  | "planning"
  | "scenarios"
  | "cases"
  | "exporting"
  | "done"
  | "error";

export type QaAuthoring = {
  status: QaAuthoringStatus;
  plan?: TestPlan;
  scenarios?: TestScenario[];
  specs?: GeneratedSpec[];
  recordPath?: string;
  error?: string;
  authoredAt?: string;
};

// ── Automated QA pipeline (doc-driven) ──────────────────────────────────────
// The dev supplies a pitch doc + PR; the pipeline generates test cases from
// those docs, executes them, logs issues on failure, and — once the fix lands —
// runs smoke then regression and reports the result back to the PR.
export type QaStageKey =
  | "docs"
  | "generate"
  | "execute"
  | "report"
  | "devfix"
  | "smoke"
  | "regression"
  | "verified";

export const QA_STAGE_ORDER: QaStageKey[] = [
  "docs",
  "generate",
  "execute",
  "report",
  "devfix",
  "smoke",
  "regression",
  "verified",
];

export const QA_STAGE_LABEL: Record<QaStageKey, string> = {
  docs: "Docs",
  generate: "Generate",
  execute: "Execute",
  report: "Report",
  devfix: "Dev fix",
  smoke: "Smoke",
  regression: "Regression",
  verified: "Reported to PR",
};

export type QaStageStatus = "idle" | "active" | "done" | "failed" | "skipped" | "paused";

export type QaStage = {
  key: QaStageKey;
  status: QaStageStatus;
  at: string | null;
};

export type PrReport = {
  postedAt: string;
  prNumber: number;
  repoId: string | null;
  summary: string;
  passed: number;
  failed: number;
  blocked: number;
  smoke: "passed" | "failed" | "skipped";
  regression: "passed" | "failed" | "skipped";
  issueNumbers: number[];
  verdict: "verified" | "blocked";
};

// Simulated comment posted back to the source Asana task once QA verifies &
// validates. Swaps to a real Asana API call once the connector is authorized.
export type AsanaComment = {
  postedAt: string;
  gid: string;
  url: string;
  verdict: "verified" | "blocked";
  body: string;
  passed: number;
  failed: number;
  issueNumbers: number[];
};

export type QaPipeline = {
  running: boolean;
  mode: "auto" | "manual";
  currentStage: QaStageKey | null;
  stages: QaStage[];
  smokePassed: boolean | null;
  regressionPassed: boolean | null;
  prReport: PrReport | null;
  asanaComment: AsanaComment | null;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  type: "Feature" | "Bug fix" | "Chore" | "Refactor";
  priority: Priority;
  productId: string;
  pr: number;
  branch: string;
  environment: string;
  devId: string;
  createdAt: string;
  status: TaskStatus;
  failIndex: number | null;
  tests: TestCase[];
  activity: ActivityEvent[];
  issue: {
    number: number;
    repoId: string;
    title: string;
    body: string;
    labels: string[];
  } | null;
  devResponded: string | null;
  fixVerification?: FixVerification;
  run: TaskRun;
  ownership: Ownership;
  pickedUpAt: string | null;
  clearedAt: string | null;
  testArtifacts: TestArtifacts;
  qaAuthoring?: QaAuthoring;
  origin: TaskOrigin;
  asana?: AsanaLink;
  github?: GithubLink;
  slack?: SlackLink;
  qaPipeline?: QaPipeline;
  links: {
    pitchDoc?: string;
    slackThread?: string;
    pullRequest: string;
    branchUrl: string;
    repository: string;
    monorepoPath?: string;
    design?: string;
    staging?: string;
  };
};

export type IssueState = "open" | "dev-responded" | "verifying" | "closed";

export type Issue = {
  id: string;
  number: number;
  title: string;
  repoId: string;
  specFile: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  productId: string;
  openedAt: string;
  state: IssueState;
  taskId: string;
  devId: string;
};

export type NotificationKind =
  | "assignment"
  | "asana-assignment"
  | "slack-assignment"
  | "github-assignment"
  | "dev-comment"
  | "verified"
  | "issue-filed";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  html: string;
  at: string;
  unread: boolean;
  route: string;
};

export type Repo = {
  id: string;
  name: string;
  owner: string;
  defaultBranch: string;
  syncedAt: string;
  surfaceIds: string[];
};

export type Product = {
  id: string;
  name: string;
  brand: Brand;
  type: "dashboard" | "shopify" | "wordpress" | "marketing" | "sdk" | "api";
  repoId: string;
  monorepoPath?: string;
  stack: string;
  projects: string[];
  coverage: number;
};

export type Dev = {
  id: string;
  name: string;
  role: string;
  slackHandle: string;
};

// App users (who sign in). Distinct from `Dev` (the people who assign QA work).
export type Role = "admin" | "qa" | "dev";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string; // e.g. "QA Engineer, PushEngage"
  handles?: { asana?: string; github?: string; slack?: string };
  active: boolean;
  /** "salt:sha256hex" of the password. Absent = no password set (demo account,
   *  any password signs in). NEVER stores plaintext. Client-side only. */
  passwordHash?: string;
};

export type Toast = {
  id: string;
  icon: "check" | "issue" | "verify" | "generate" | "merge" | "sync";
  title: string;
  subtitle: string;
};
