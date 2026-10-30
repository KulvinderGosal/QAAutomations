// Server-side Claude integration for TestPilot's AI QA authoring pipeline.
// Runs inside the Vite dev server (Node) — the Anthropic key is read from .env
// server-side and NEVER reaches the browser bundle, exactly like aiTest.ts.
//
// Four jobs, chained by the store via /api/qa/*:
//   1. planTask       — read the assigned task → a structured Test Plan (which
//                        areas to test, environment, target framework, browsers,
//                        viewports, risks).
//   2. scenariosForTask — enumerate test scenarios INCLUDING corner cases
//                        (negative / boundary / edge / error / security / a11y /
//                        responsive), each with steps + expected result.
//   3. casesForTask   — author a real, runnable Playwright spec implementing the
//                        scenarios, then saveSpec() it into the matched
//                        framework's ai-generated/ folder (additive, uncommitted).
//   4. exportRecord   — write a durable Excel workbook (Test Plan / Scenarios /
//                        Cases / Coverage) to ~/QA-Automations/testpilot-qa-records/.
//
// exceljs is a devDependency imported ONLY here (server side) — never by src/,
// so it never enters the client bundle (same discipline as @anthropic-ai/sdk).
import type Anthropic from "@anthropic-ai/sdk";
// exceljs is CommonJS — default-import the module and destructure the class, so
// Vite's ESM config loader can load it (named ESM imports fail at runtime).
import ExcelJS from "exceljs";
import type { Fill, Worksheet } from "exceljs";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  AiError,
  MODEL,
  firstText,
  requestError,
  saveSpec,
  sendMessage,
  stripFence,
  type AiCreds,
} from "./aiTest";
import { FRAMEWORKS, QA_ROOT } from "./runner";

export const RECORDS_DIR = path.join(QA_ROOT, "testpilot-qa-records");

// ── Shared shapes (mirror src/types.ts; server stays import-independent) ─────
export type TestArea =
  | "ui"
  | "unit"
  | "functional"
  | "cross-browser"
  | "responsive"
  | "a11y"
  | "perf"
  | "regression";

const AREAS: TestArea[] = [
  "ui",
  "unit",
  "functional",
  "cross-browser",
  "responsive",
  "a11y",
  "perf",
  "regression",
];

export type ScenarioType =
  | "happy-path"
  | "negative"
  | "boundary"
  | "edge"
  | "error"
  | "security"
  | "a11y"
  | "responsive";

const SCENARIO_TYPES: ScenarioType[] = [
  "happy-path",
  "negative",
  "boundary",
  "edge",
  "error",
  "security",
  "a11y",
  "responsive",
];

const PRIORITIES = ["High", "Medium", "Low"] as const;
type Priority = (typeof PRIORITIES)[number];

export type PlanArea = { area: TestArea; inScope: boolean; priority: Priority; rationale: string };

export type TestPlan = {
  summary: string;
  environment: string;
  frameworkId: string;
  areas: PlanArea[];
  browsers: string[];
  viewports: string[];
  risks: string[];
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

export type GeneratedSpec = { filename: string; savedPath?: string };

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
  /** productId-derived default framework, passed to the model as a hint. */
  defaultFrameworkId?: string;
};

/** The frameworks the model may target for generated specs (id + label). */
function frameworkChoices(): { id: string; label: string; brand: string }[] {
  return FRAMEWORKS.map((f) => ({ id: f.id, label: f.label, brand: f.brand }));
}

/** Compact, model-facing description of the task under test. */
function taskContext(input: PlanInput): string {
  const L = input.links ?? {};
  const lines = [
    `Title: ${input.title}`,
    input.type ? `Type: ${input.type}` : "",
    input.priority ? `Priority: ${input.priority}` : "",
    input.brand ? `Brand: ${input.brand}` : "",
    input.productName ? `Product: ${input.productName}` : "",
    input.origin ? `Source: ${input.origin}` : "",
    input.pr ? `PR: #${input.pr}` : "",
    input.branch ? `Branch: ${input.branch}` : "",
    input.environment ? `Environment: ${input.environment}` : "",
    input.description ? `\nDescription:\n${input.description}` : "",
    input.acceptanceCriteria ? `\nAcceptance criteria:\n${input.acceptanceCriteria}` : "",
    L.pullRequest ? `PR URL: ${L.pullRequest}` : "",
    L.repository ? `Repo: ${L.repository}` : "",
    L.staging ? `Staging URL: ${L.staging}` : "",
    L.design ? `Design: ${L.design}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Best-effort target URL for generated specs (overridable at run time). */
function targetUrl(input: PlanInput): string {
  return input.links?.staging?.trim() || "https://staging.example.com";
}

// ── 1. Plan ─────────────────────────────────────────────────────────────────

function planSchema(frameworkIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string", description: "One or two sentences: what this task changes and the QA strategy." },
      environment: { type: "string", description: "The environment QA should target, e.g. 'Staging' or a URL." },
      frameworkId: {
        type: "string",
        enum: frameworkIds,
        description: "Which local Playwright QA framework these tests belong in.",
      },
      areas: {
        type: "array",
        description: "Every test area, marked in- or out-of-scope for THIS task, with a one-line rationale.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            area: { type: "string", enum: AREAS },
            inScope: { type: "boolean" },
            priority: { type: "string", enum: PRIORITIES },
            rationale: { type: "string", description: "Why this area is or isn't worth testing here." },
          },
          required: ["area", "inScope", "priority", "rationale"],
        },
      },
      browsers: { type: "array", items: { type: "string" }, description: "Browsers to cover, e.g. Chromium, Firefox, WebKit." },
      viewports: { type: "array", items: { type: "string" }, description: "Viewports to cover, e.g. 'Desktop 1280', 'Mobile 375'." },
      risks: { type: "array", items: { type: "string" }, description: "Notable QA risks or things easy to miss." },
    },
    required: ["summary", "environment", "frameworkId", "areas", "browsers", "viewports", "risks"],
  } as const;
}

const PLAN_SYSTEM = `You are a senior QA lead planning the test coverage for one engineering task.
Produce a focused, realistic test plan a QA engineer will actually execute.
Rules:
- Cover ALL test areas in the "areas" list, but be honest about scope: mark inScope=false with a short rationale for areas that don't apply to this task (e.g. "unit" for a pure CSS change, "perf" for a copy tweak). Do NOT pad scope.
- Choose the single frameworkId whose product/surface best matches the task; a suggested default is provided — only deviate if it's clearly wrong.
- browsers/viewports should reflect what the change actually risks (a responsive layout change needs mobile viewports + WebKit; a backend/API change may just need Chromium).
- Be specific to THIS task in every rationale — never generic boilerplate.`;

export async function planTask(creds: AiCreds, input: PlanInput): Promise<TestPlan> {
  const ids = FRAMEWORKS.map((f) => f.id);
  const choices = frameworkChoices()
    .map((f) => `  - ${f.id} — ${f.label} (${f.brand})`)
    .join("\n");
  let res: Anthropic.Message;
  try {
    res = await sendMessage(creds, {
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: "medium", format: { type: "json_schema", schema: planSchema(ids) } },
      system: PLAN_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Task under test:\n${taskContext(input)}\n\nAvailable QA frameworks (pick one frameworkId):\n${choices}\n${
            input.defaultFrameworkId ? `\nSuggested default framework: ${input.defaultFrameworkId}` : ""
          }`,
        },
      ],
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw requestError(e);
  }
  if (res.stop_reason === "refusal") throw new AiError(422, "Claude declined to plan this task.");
  const plan = safeParse<TestPlan>(firstText(res));
  // Guard the framework id (the enum should already constrain it, but be safe).
  if (!ids.includes(plan.frameworkId)) plan.frameworkId = input.defaultFrameworkId ?? ids[0];
  plan.areas = Array.isArray(plan.areas) ? plan.areas : [];
  plan.browsers = plan.browsers ?? [];
  plan.viewports = plan.viewports ?? [];
  plan.risks = plan.risks ?? [];
  return plan;
}

// ── Requirements coverage-gap analysis (AI) ──────────────────────────────────
// Compare ONE requirement (+ its acceptance criteria) against its linked cases and
// surface the behaviours that aren't tested yet, plus the cases to add. The AI
// analog of the n8n "compare acceptance criteria vs existing cases" QA workflow.
export type CoverageRequirement = { key: string; title: string; description?: string; acceptanceCriteria?: string };
export type CoverageCase = { key: string; title: string; steps?: string[] };
export type CoverageGap = {
  verdict: "well-covered" | "partial" | "gap";
  summary: string;
  untested: string[];
  suggestedCases: { title: string; rationale: string }[];
};

const COVERAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["well-covered", "partial", "gap"] },
    summary: { type: "string", description: "One or two sentences on how well this requirement is covered." },
    untested: { type: "array", items: { type: "string" }, description: "Specific behaviours / acceptance criteria not exercised by any existing case." },
    suggestedCases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: { type: "string" }, rationale: { type: "string" } },
        required: ["title", "rationale"],
      },
    },
  },
  required: ["verdict", "summary", "untested", "suggestedCases"],
} as const;

const COVERAGE_SYSTEM = `You are a senior QA lead auditing the test coverage of ONE requirement.
Compare the requirement (and any acceptance criteria) against the existing linked test cases.
Rules:
- Identify behaviours / acceptance criteria NOT exercised by any existing case — the coverage gaps. Be specific and concrete to THIS requirement.
- Push on corner cases: negative inputs, boundary values, empty/duplicate/max data, error handling, permission/auth edges — flag any that are untested.
- verdict: "well-covered" when every important behaviour has a case; "partial" when some do; "gap" when little or nothing is covered.
- suggestedCases: propose the missing cases (short imperative title + one-line rationale). Empty array when well-covered.
- Be honest and non-redundant — do not pad.`;

export async function coverageGap(
  creds: AiCreds,
  input: { requirement: CoverageRequirement; cases: CoverageCase[] },
): Promise<CoverageGap> {
  const r = input.requirement;
  const caseList = input.cases.length
    ? input.cases
        .map((c, i) => `  ${i + 1}. [${c.key}] ${c.title}${c.steps?.length ? `\n     steps: ${c.steps.join(" | ")}` : ""}`)
        .join("\n")
    : "  (no cases are linked to this requirement)";
  let res: Anthropic.Message;
  try {
    res = await sendMessage(creds, {
      model: MODEL,
      max_tokens: 1600,
      output_config: { effort: "medium", format: { type: "json_schema", schema: COVERAGE_SCHEMA } },
      system: COVERAGE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Requirement [${r.key}]: ${r.title}\n${r.description ? `Description: ${r.description}\n` : ""}${
            r.acceptanceCriteria ? `Acceptance criteria:\n${r.acceptanceCriteria}\n` : ""
          }\nExisting linked test cases:\n${caseList}`,
        },
      ],
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw requestError(e);
  }
  if (res.stop_reason === "refusal") throw new AiError(422, "Claude declined to analyze coverage.");
  const out = safeParse<CoverageGap>(firstText(res));
  out.untested = Array.isArray(out.untested) ? out.untested : [];
  out.suggestedCases = Array.isArray(out.suggestedCases) ? out.suggestedCases : [];
  return out;
}

// ── 2. Scenarios ─────────────────────────────────────────────────────────────

const SCENARIOS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    scenarios: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Short imperative scenario name." },
          area: { type: "string", enum: AREAS },
          type: { type: "string", enum: SCENARIO_TYPES },
          priority: { type: "string", enum: PRIORITIES },
          steps: { type: "array", items: { type: "string" }, description: "Ordered, concrete steps to execute." },
          expected: { type: "string", description: "The observable expected result." },
        },
        required: ["title", "area", "type", "priority", "steps", "expected"],
      },
    },
  },
  required: ["scenarios"],
} as const;

const SCENARIOS_SYSTEM = `You are a meticulous QA engineer writing test scenarios for one task.
Given the task and its test plan, enumerate the scenarios worth testing.
Rules:
- Cover the happy path FIRST, then push hard on CORNER CASES: negative inputs, boundary values, empty/duplicate/max-length data, error handling, permission/auth edges, race conditions, and (where relevant) accessibility and responsive/mobile behaviour.
- Only produce scenarios for areas the plan marked inScope; weight the count toward higher-priority areas.
- Each scenario must be concrete and executable — real steps and a single clear expected result, specific to THIS task (no generic filler).
- Aim for thorough but non-redundant coverage (typically 6–16 scenarios depending on task size).`;

export async function scenariosForTask(creds: AiCreds, input: PlanInput, plan: TestPlan): Promise<TestScenario[]> {
  const inScope = plan.areas.filter((a) => a.inScope).map((a) => `${a.area} (${a.priority})`).join(", ") || "all areas";
  let res: Anthropic.Message;
  try {
    res = await sendMessage(creds, {
      model: MODEL,
      max_tokens: 4096,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCENARIOS_SCHEMA } },
      system: SCENARIOS_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Task under test:\n${taskContext(input)}\n\nTest plan summary: ${plan.summary}\nIn-scope areas: ${inScope}\nBrowsers: ${plan.browsers.join(
            ", ",
          )}\nViewports: ${plan.viewports.join(", ")}\n\nEnumerate the test scenarios, emphasising corner cases.`,
        },
      ],
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw requestError(e);
  }
  if (res.stop_reason === "refusal") throw new AiError(422, "Claude declined to enumerate scenarios.");
  const parsed = safeParse<{ scenarios: Omit<TestScenario, "id">[] }>(firstText(res));
  const list = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
  return list.map((s, i) => ({ ...s, id: `SC-${i + 1}`, steps: Array.isArray(s.steps) ? s.steps : [] }));
}

// ── 3. Playwright cases ──────────────────────────────────────────────────────

const CASES_SYSTEM = `You are a senior QA automation engineer. Write ONE self-contained Playwright test spec (TypeScript, @playwright/test) implementing the provided test scenarios for the task.
STRICT output rules:
- Output ONLY the file contents. No markdown fences, no commentary before or after.
- Start with: import { test, expect } from '@playwright/test';
- Read the base URL from process.env.ADHOC_URL ?? '<target url>' so runs can override it.
- If sign-in is needed, read credentials from process.env.ADHOC_USER and process.env.ADHOC_PASS. NEVER hardcode credentials, tokens, cookies, or any secret.
- One test() per scenario. Put the scenario id and a "@generated" tag plus the area tag (e.g. "@ui") in each test title, e.g. test('SC-3 rejects empty email @generated @functional', ...).
- Group tests with test.describe. Prefer resilient, user-facing locators (getByRole, getByLabel, getByText) over brittle CSS/XPath.
- Runnable as-is: no external page objects, fixtures, or imports beyond @playwright/test.
- Add a brief inline comment only where a step is non-obvious.`;

export async function casesForTask(
  creds: AiCreds,
  input: PlanInput,
  plan: TestPlan,
  scenarios: TestScenario[],
): Promise<{ filename: string; spec: string }> {
  const url = targetUrl(input);
  const inScope = plan.areas.filter((a) => a.inScope).map((a) => a.area).join(", ") || "all areas";
  const scenarioBlock = scenarios
    .map((s) => `${s.id} [${s.area}/${s.type}] ${s.title}\n  Steps: ${s.steps.join(" → ")}\n  Expected: ${s.expected}`)
    .join("\n\n");
  let res: Anthropic.Message;
  try {
    res = await sendMessage(creds, {
      model: MODEL,
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: CASES_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Target URL: ${url}\n\nTask:\n${taskContext(input)}\n\nIn-scope test areas: ${inScope}. Environment: ${plan.environment}.\n\nImplement these scenarios as Playwright tests:\n\n${scenarioBlock}`,
        },
      ],
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw requestError(e);
  }
  if (res.stop_reason === "refusal") throw new AiError(422, "Claude declined to generate tests for this task.");
  const spec = stripFence(firstText(res));
  if (!spec) throw new AiError(502, "Claude returned an empty spec.");
  return { filename: slug(input.title), spec };
}

/**
 * Generate the Playwright spec AND save it into the framework's ai-generated/
 * folder. Returns the generated spec(s) with their on-disk paths.
 */
export async function generateAndSaveCases(
  creds: AiCreds,
  input: PlanInput,
  plan: TestPlan,
  scenarios: TestScenario[],
): Promise<GeneratedSpec[]> {
  const { filename, spec } = await casesForTask(creds, input, plan, scenarios);
  const { path: savedPath } = await saveSpec(plan.frameworkId, filename, spec);
  return [{ filename: path.basename(savedPath), savedPath }];
}

// ── 4. Excel record ──────────────────────────────────────────────────────────

const HEADER_FILL: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

function headerRow(ws: Worksheet, cols: string[]) {
  const row = ws.addRow(cols);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

export async function exportRecord(
  input: PlanInput,
  plan: TestPlan,
  scenarios: TestScenario[],
  cases: GeneratedSpec[],
): Promise<{ path: string; filename: string }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TestPilot";
  wb.created = new Date();

  const fwLabel = FRAMEWORKS.find((f) => f.id === plan.frameworkId)?.label ?? plan.frameworkId;

  // Sheet 1 — Test Plan
  const p = wb.addWorksheet("Test Plan");
  p.columns = [{ width: 22 }, { width: 90 }];
  const meta: [string, string][] = [
    ["Task", input.title],
    ["Type", input.type ?? "—"],
    ["Priority", input.priority ?? "—"],
    ["Product", input.productName ?? "—"],
    ["Brand", input.brand ?? "—"],
    ["Source", input.origin ?? "—"],
    ["PR", input.pr ? `#${input.pr}` : "—"],
    ["Environment", plan.environment],
    ["Framework", `${fwLabel} (${plan.frameworkId})`],
    ["Browsers", plan.browsers.join(", ") || "—"],
    ["Viewports", plan.viewports.join(", ") || "—"],
    ["Summary", plan.summary],
    ["Risks", plan.risks.join("\n") || "—"],
    ["Generated", new Date().toLocaleString()],
  ];
  for (const [k, v] of meta) {
    const row = p.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }
  p.addRow([]);
  headerRow(p, ["Test area", "In scope", "Priority", "Rationale"]);
  p.getColumn(3).width = 12;
  for (const a of plan.areas) {
    const row = p.addRow([a.area, a.inScope ? "Yes" : "No", a.priority, a.rationale]);
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
  }

  // Sheet 2 — Test Scenarios
  const s = wb.addWorksheet("Test Scenarios");
  s.columns = [{ width: 10 }, { width: 40 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 50 }, { width: 45 }];
  headerRow(s, ["ID", "Title", "Area", "Type", "Priority", "Steps", "Expected"]);
  for (const sc of scenarios) {
    const row = s.addRow([
      sc.id,
      sc.title,
      sc.area,
      sc.type,
      sc.priority,
      sc.steps.map((t, i) => `${i + 1}. ${t}`).join("\n"),
      sc.expected,
    ]);
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.getCell(6).alignment = { wrapText: true, vertical: "top" };
    row.getCell(7).alignment = { wrapText: true, vertical: "top" };
  }

  // Sheet 3 — Test Cases (generated Playwright spec files + the tests within)
  const cs = wb.addWorksheet("Test Cases");
  cs.columns = [{ width: 10 }, { width: 40 }, { width: 14 }, { width: 14 }, { width: 70 }];
  headerRow(cs, ["Scenario", "Title", "Area", "Type", "Spec file"]);
  const specPath = cases[0]?.savedPath ?? "—";
  for (const sc of scenarios) {
    cs.addRow([sc.id, sc.title, sc.area, sc.type, specPath]);
  }

  // Sheet 4 — Coverage
  const cv = wb.addWorksheet("Coverage");
  cv.columns = [{ width: 28 }, { width: 60 }];
  const inScope = plan.areas.filter((a) => a.inScope);
  const byType = SCENARIO_TYPES.map((t) => {
    const n = scenarios.filter((x) => x.type === t).length;
    return n ? `${t}: ${n}` : "";
  }).filter(Boolean);
  const byArea = AREAS.map((a) => {
    const n = scenarios.filter((x) => x.area === a).length;
    return n ? `${a}: ${n}` : "";
  }).filter(Boolean);
  const cov: [string, string][] = [
    ["Areas in scope", `${inScope.length} / ${plan.areas.length}`],
    ["In-scope areas", inScope.map((a) => a.area).join(", ") || "—"],
    ["Total scenarios", String(scenarios.length)],
    ["Scenarios by type", byType.join("\n") || "—"],
    ["Scenarios by area", byArea.join("\n") || "—"],
    ["Generated spec files", cases.map((c) => c.savedPath ?? c.filename).join("\n") || "—"],
    ["Browsers", plan.browsers.join(", ") || "—"],
    ["Viewports", plan.viewports.join(", ") || "—"],
    ["Generated at", new Date().toLocaleString()],
  ];
  for (const [k, v] of cov) {
    const row = cv.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  await mkdir(RECORDS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${slug(input.title).replace(/\.spec\.ts$/, "")}-${stamp}.xlsx`;
  const target = path.join(RECORDS_DIR, filename);
  await wb.xlsx.writeFile(target);
  return { path: target, filename };
}

/** Serve a previously-written record — only from inside RECORDS_DIR. */
export function resolveRecordPath(requested: string): string {
  const resolved = path.resolve(requested);
  const dir = path.resolve(RECORDS_DIR);
  if (resolved !== dir && !resolved.startsWith(dir + path.sep)) {
    throw new AiError(400, "Path is outside the records directory.");
  }
  if (!resolved.endsWith(".xlsx") || !existsSync(resolved)) {
    throw new AiError(404, "Record not found.");
  }
  return resolved;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function slug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "qa-plan"}.spec.ts`;
}

function safeParse<T>(text: string): T {
  try {
    return JSON.parse(text.trim()) as T;
  } catch {
    throw new AiError(502, "Claude returned an unparseable response.");
  }
}
