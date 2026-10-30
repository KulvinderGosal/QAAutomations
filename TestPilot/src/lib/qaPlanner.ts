// Client-side helpers for the AI QA authoring pipeline. All calls go to our
// same-origin /api/qa/* middleware (server/qaPlanner.ts) — the Anthropic key
// stays server-side, and generated specs / Excel records are written on the
// server. Types mirror the server + src/types.ts shapes.
import type { ApiError } from "./runner";
import type { GeneratedSpec, TestPlan, TestScenario } from "@/types";

// What the store sends the server to describe the task under test.
export type PlanInput = {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  type?: string;
  priority?: string;
  brand?: string;
  productName?: string;
  origin?: string;
  pr?: number;
  branch?: string;
  environment?: string;
  links?: {
    pullRequest?: string;
    repository?: string;
    staging?: string;
    design?: string;
    pitchDoc?: string;
  };
  defaultFrameworkId?: string;
};

// productId → default QA framework id (server/runner.ts FRAMEWORKS). The model
// may override in the plan, but this is the sensible starting point. Products
// without a dedicated framework (sdk / api / non-existent Shopify) fall back by
// brand in defaultFrameworkFor().
const PRODUCT_FRAMEWORK: Record<string, string> = {
  "pe-wp-plugin": "pushengage-wp-plugin",
  "pe-app-dashboard": "pushengage-app-dashboard",
  "pe-shopify": "pushengage-shopify-revamped",
  "pe-site": "pushengage-site",
  "pe-sdk": "pushengage-app-dashboard",
  "lp-dashboard": "ledgerport-saas-automation",
  "lp-wp-plugin": "ledgerport-wp-plugin",
  "lp-site": "ledgerport-marketing-site",
  "lp-shopify": "ledgerport-saas-automation",
  "lp-api": "ledgerport-saas-automation",
};

export function defaultFrameworkFor(productId: string, brand?: string): string {
  return PRODUCT_FRAMEWORK[productId] ?? (brand === "LedgerPort" ? "ledgerport-saas-automation" : "pushengage-app-dashboard");
}

async function json<T>(r: Response): Promise<T> {
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) {
    const err: ApiError = new Error(body.error || `Request failed (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return body;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json<T>(r));
}

export function aiPlanTask(input: PlanInput): Promise<{ plan: TestPlan }> {
  return post("/api/qa/plan", { input });
}

export function aiScenarios(input: PlanInput, plan: TestPlan): Promise<{ scenarios: TestScenario[] }> {
  return post("/api/qa/scenarios", { input, plan });
}

export function aiCases(
  input: PlanInput,
  plan: TestPlan,
  scenarios: TestScenario[],
): Promise<{ specs: GeneratedSpec[] }> {
  return post("/api/qa/cases", { input, plan, scenarios });
}

export function aiExportRecord(
  input: PlanInput,
  plan: TestPlan,
  scenarios: TestScenario[],
  specs: GeneratedSpec[],
): Promise<{ path: string; filename: string }> {
  return post("/api/qa/export", { input, plan, scenarios, specs });
}

/** Same-origin URL that streams a previously-written Excel record for download. */
export function qaRecordDownloadUrl(recordPath: string): string {
  return `/api/qa/record?path=${encodeURIComponent(recordPath)}`;
}

// ── Requirements coverage-gap analysis ───────────────────────────────────────
export type CoverageReqInput = { key: string; title: string; description?: string; acceptanceCriteria?: string };
export type CoverageCaseInput = { key: string; title: string; steps?: string[] };
export type CoverageGap = {
  verdict: "well-covered" | "partial" | "gap";
  summary: string;
  untested: string[];
  suggestedCases: { title: string; rationale: string }[];
};

/** Ask Claude which behaviours of a requirement aren't covered by its linked
 *  cases. Same 402 credit gate as the rest of the AI features. */
export function aiCoverageGap(requirement: CoverageReqInput, cases: CoverageCaseInput[]): Promise<{ gap: CoverageGap }> {
  return post("/api/qa/coverage", { requirement, cases });
}
