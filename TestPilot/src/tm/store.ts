// Zustand store for the test-management domain. Persisted to a single
// localStorage key (`testpilot.tm`), seeded from the product list on first run.
// Kept separate from the main app store (useStore) so the TMS model is
// self-contained; it reads useStore lazily only to stamp the acting user and to
// drive the shared runner/RunPanel when executing an automated case.
import { create } from "zustand";
import { products } from "@/data/mock";
import { useStore } from "@/store/useStore";
import { aiPlanTask, aiScenarios, defaultFrameworkFor, type PlanInput } from "@/lib/qaPlanner";
import { startRunnerRun, fetchRun, fetchSpecs, cancelRunnerRun, verdictNote, type ApiError, type Verdict } from "@/lib/runner";
import { runPerf, type PerfRunInput } from "@/lib/perf";
import type { GithubPr } from "@/lib/github";
import type { Priority, TestScenario } from "@/types";
import { saveDeviceReport } from "@/lib/deviceReports";
import { fetchTmState, saveTmState } from "@/lib/tmStore";
import type { ImportApplied } from "@/lib/asanaImport";
import { TM_FRAMEWORKS } from "./types";
import { MOBILE_SDK_SUITES, ANDROID_SDK_CASES, IOS_SDK_CASES, type MobileSeedCase } from "./mobileSdkSeed";
import { IAM_ANDROID_SUITES, IAM_ANDROID_CASES, IAM_MAESTRO_COVERAGE } from "./iamAndroidSeed";
import { IAM_DASH_SUITES, IAM_DASH_CASES } from "./iamDashboardSeed";
import { IAM_IOS_SUITES, IAM_IOS_CASES, IAM_IOS_RUNNABLE, IAM_IOS_ASSERT } from "./iamIosSeed";
import { IAM_DEVICE_SUITES, IAM_DEVICE_CASES } from "./iamDeviceSeed";
import { LP_PR237_SUITES, LP_PR237_CASES } from "./ledgerportPr237Seed";
import { EXT_SUITES, EXT_CASES } from "./extensionSeed";
import { IAM_0917_SUITES, IAM_0917_CASES } from "./iamBuild0917Seed";
import { RECENT_QA_SUITES, RECENT_QA_CASES } from "./recentQaSeed";
import { AI_ONBOARDING_SUITES, AI_ONBOARDING_CASES } from "./aiOnboardingSeed";
import type {
  TmActivity,
  TmCase,
  TmDefect,
  TmDeviceRun,
  TmDeviceRunResult,
  TmExecution,
  TmPerfRun,
  TmPlan,
  TmPriority,
  TmRelease,
  TmRequirement,
  TmRisk,
  TmRunStatus,
  TmStep,
  TmSuite,
} from "./types";

const KEY = "testpilot.tm";

// V2a: keys a Playwright spec carries as `@case:<KEY>` (tags or title). Mirrors
// caseKeysFromSpec in server/qaLoop/intake.ts.
function caseKeysFromSpec(title: string, tags: string[] = []): string[] {
  const out = new Set<string>();
  for (const src of [title || "", ...(tags || [])]) for (const m of src.matchAll(/@case:([A-Z]{2,6}(?:-[A-Z0-9]+)+)/g)) out.add(m[1]);
  return [...out];
}

// Which seed product suite each runner framework's specs import into.
const FRAMEWORK_PRODUCT: Record<string, string> = {
  "pushengage-site": "pe-site",
  "pushengage-app-dashboard": "pe-app-dashboard",
  "pushengage-shopify-revamped": "pe-shopify",
  "pushengage-wp-plugin": "pe-wp-plugin",
  "ledgerport-saas-automation": "lp-dashboard",
  "ledgerport-wp-plugin": "lp-wp-plugin",
  "ledgerport-shopify": "lp-shopify",
  "ledgerport-marketing-site": "lp-site",
};

type Persisted = {
  suites: TmSuite[];
  cases: TmCase[];
  plans: TmPlan[];
  executions: TmExecution[];
  requirements: TmRequirement[];
  risks: TmRisk[];
  releases: TmRelease[];
  defects: TmDefect[];
  activity: TmActivity[];
  deviceRuns: TmDeviceRun[];
  perfRuns: TmPerfRun[];
  seq: Record<string, number>;
};

let idSeq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;
const now = () => new Date().toISOString();

function actor(): string {
  try {
    const s = useStore.getState();
    return s.users.find((u) => u.id === s.currentUserId)?.name ?? "QA";
  } catch {
    return "QA";
  }
}

// Build the mobile-SDK (Android + iOS) seed cases as TmCase objects. These are
// MANUAL cases (mobile SDKs run on real devices/emulators, not the Playwright
// runner), with stable ids so the load() backfill is idempotent.
function buildMobileCases(): TmCase[] {
  const build = (suiteId: string, prefix: string, list: MobileSeedCase[]): TmCase[] =>
    list.map((c, i) => {
      const n = i + 1;
      return {
        id: `seedcase-${prefix}-${n}`,
        key: `TC-${prefix.toUpperCase()}-${n}`,
        title: c.title,
        description: "",
        suiteId,
        priority: c.priority,
        automation: "manual",
        steps: c.steps,
        tags: [c.area],
        review: "approved",
        frameworkId: null,
        specFile: null,
        lastRunStatus: "unexecuted",
        lastRunAt: null,
        runs: 0,
        source: "seed",
        createdBy: "TestPilot",
        createdAt: now(),
        updatedAt: now(),
        comments: [],
        history: [],
      };
    });
  return [...build("suite-pe-android-sdk", "and", ANDROID_SDK_CASES), ...build("suite-pe-ios-sdk", "ios", IOS_SDK_CASES)];
}

// Build the IAM Android (In-App Messaging) seed cases as TmCase objects — MANUAL,
// on-device scenarios imported from the Asana IAM umbrella task. Each seed case
// already carries its target area sub-suite id + a stable id, so the load()
// backfill is idempotent.
function buildIamCases(): TmCase[] {
  return IAM_ANDROID_CASES.map((c) => {
    // Cases with an authored Maestro flow get a "maestro" tag + the flow path in
    // specFile so the board shows Maestro-covered vs pure-manual. They stay
    // automation:"manual" — the flows run via Maestro on a device, not the runner.
    const flow = IAM_MAESTRO_COVERAGE[c.key];
    return {
    id: c.id,
    key: c.key,
    title: c.title,
    description: "",
    suiteId: c.suiteId,
    priority: c.priority,
    automation: "manual",
    steps: c.steps,
    tags: flow ? ["iam", c.area.toLowerCase(), "maestro"] : ["iam", c.area.toLowerCase()],
    review: "approved",
    frameworkId: null,
    specFile: flow ?? null,
    lastRunStatus: "unexecuted",
    lastRunAt: null,
    runs: 0,
    source: "seed",
    createdBy: "TestPilot",
    createdAt: now(),
    updatedAt: now(),
    comments: [],
    history: [],
    };
  });
}

// One-time backfill so the mobile-SDK suites/cases appear in an ALREADY-persisted
// install (load() otherwise returns stored data untouched). Guarded by
// seq.mobileSeed so it runs once — a user who later deletes a mobile case won't
// have it re-added on the next load.
function backfillMobile(p: Persisted): Persisted {
  if (p.seq.mobileSeed) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const addSuites = MOBILE_SDK_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = buildMobileCases().filter((c) => !haveCases.has(c.id));
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...p.cases, ...addCases],
    seq: { ...p.seq, mobileSeed: 1 },
    activity:
      addSuites.length || addCases.length
        ? [
            { id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: "Added <b>PushEngage Android + iOS SDK</b> test suites" },
            ...p.activity,
          ]
        : p.activity,
  };
  save(next);
  return next;
}

// Versioned backfill for the IAM Android (In-App Messaging) suites/cases in an
// already-persisted install. Guarded by seq.iamSeed as a VERSION (not a boolean):
// bump IAM_SEED_VERSION whenever new cases are added to the seed so existing
// installs get the additions once. Within a run it only adds cases/suites whose id
// is missing, so a case the user deleted at the current version won't reappear.
// v2 (2026-08-11): + CONTENT (2) and PERSIST (3) areas from the 2nd Asana refresh.
// v3 (2026-08-11): fix — CONTENT/PERSIST are 7-letter areas that slipped past the
// old [A-Z]{2,6} area matcher and landed in a stray "suite-iam-misc"; prune that
// and re-add them under their correct suites (regex widened to {2,8} in the seed).
const IAM_SEED_VERSION = 3;
function backfillIam(p: Persisted): Persisted {
  if ((p.seq.iamSeed ?? 0) >= IAM_SEED_VERSION) return p;
  // Drop the stray MISC suite/cases from the v2 regex bug before re-adding.
  const pruned: Persisted = {
    ...p,
    suites: p.suites.filter((s) => s.id !== "suite-iam-misc"),
    cases: p.cases.filter((c) => !c.id.startsWith("seedcase-iam-misc-")),
  };
  const haveSuites = new Set(pruned.suites.map((s) => s.id));
  const haveCases = new Set(pruned.cases.map((c) => c.id));
  const addSuites = IAM_ANDROID_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = buildIamCases().filter((c) => !haveCases.has(c.id));
  const next: Persisted = {
    ...pruned,
    suites: [...pruned.suites, ...addSuites],
    cases: [...pruned.cases, ...addCases],
    seq: { ...pruned.seq, iamSeed: IAM_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [
            { id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>IAM Android — In-App Messaging</b> suite (${addCases.length} cases)` },
            ...pruned.activity,
          ]
        : pruned.activity,
  };
  save(next);
  return next;
}

function buildIamDashCases(): TmCase[] {
  return IAM_DASH_CASES.map((c) => ({
    id: c.id,
    key: c.key,
    title: c.title,
    description: "",
    suiteId: c.suiteId,
    priority: c.priority,
    // Bound to real Playwright specs (pushengage-app-dashboard/tests/in-app-campaigns/)
    // so the TMS "Run" executes each case on the runner. The specs self-skip
    // without a captured app-dashboard session (npm run auth:capture).
    automation: "automated",
    steps: c.steps,
    tags: ["iam", "app-dashboard", c.area.toLowerCase()],
    review: "approved",
    frameworkId: "pushengage-app-dashboard",
    specFile: `tests/in-app-campaigns/${c.key.toLowerCase()}.spec.ts`,
    lastRunStatus: "unexecuted",
    lastRunAt: null,
    runs: 0,
    source: "seed",
    createdBy: "TestPilot",
    createdAt: now(),
    updatedAt: now(),
    comments: [],
    history: [],
  }));
}

// Seed the App-Dashboard IAM suite (browser QA for the in-app-campaigns feature)
// onto an already-persisted install. Guarded by seq.iamDashSeed as a VERSION so
// future additions land once; only adds suites/cases whose id is missing (a
// user-deleted case at the current version won't reappear).
// v2 (2026-08-17): the IAMD cases are now bound to real Playwright specs
// (manual → automated). Re-apply the binding onto already-persisted cases,
// preserving each case's run history/status.
// v3 (2026-09-22): added the 3 cases that existed as real specs but were missing
// from the seed — IAMD-AUD-07/08 (Audience targeting) + IAMD-DSP-01 (new "Display
// behaviour" sub-suite). Aligns the seed with the deduped App-Dashboard IAM suite
// (the imported flat `in-app-campaigns` duplicate suite was removed).
const IAM_DASH_SEED_VERSION = 3;
function backfillIamDash(p: Persisted): Persisted {
  if ((p.seq.iamDashSeed ?? 0) >= IAM_DASH_SEED_VERSION) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const built = buildIamDashCases();
  const bindById = new Map(built.map((c) => [c.id, c]));
  const addSuites = IAM_DASH_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = built.filter((c) => !haveCases.has(c.id));
  // Re-bind existing IAMD cases to their spec, keeping run history/status intact.
  const rebound = p.cases.map((c) => {
    const b = bindById.get(c.id);
    return b ? { ...c, automation: b.automation, frameworkId: b.frameworkId, specFile: b.specFile } : c;
  });
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...rebound, ...addCases],
    seq: { ...p.seq, iamDashSeed: IAM_DASH_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [
            { id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>IAM — App Dashboard</b> suite (${addCases.length} cases)` },
            ...p.activity,
          ]
        : p.activity,
  };
  save(next);
  return next;
}

// Turn a passed (app-launched, no-crash) iOS device run into an HONEST verdict:
// only cases we can auto-verify from the SDK state dump get passed/failed; the
// rest are "skipped" (launched + screenshot captured — record the real result
// manually from the screenshot). Non-iOS runs are unaffected.
function assessIosRun(key: string, output: string): { status: TmRunStatus; note: string } {
  const a = IAM_IOS_ASSERT[key];
  if (!a) return { status: "skipped", note: "launched on device — verify from the screenshot & record result" };
  if (a === "synced")
    return { status: /Total Campaigns:\s*[1-9]/.test(output) ? "passed" : "failed", note: "auto-check: campaigns synced" };
  if (a === "impression")
    // ≥1 unsynced event = an impression was recorded → pass; 0 usually means nothing
    // displayed (e.g. frequency-capped), which isn't a defect → leave for manual.
    return /Unsynced Analytics Events:\s*[1-9]/.test(output)
      ? { status: "passed", note: "auto-check: impression recorded" }
      : { status: "skipped", note: "no impression this run (likely capped) — verify from screenshot" };
  if (a === "display")
    // run-case.sh v2 dense-captures + auto-detects a rendered banner (IAM_DISPLAY).
    return /IAM_DISPLAY:\s*shown/.test(output)
      ? { status: "passed", note: "auto-check: in-app message displayed on device — confirm position/content from the screenshot" }
      : { status: "skipped", note: "no banner detected this run (event may not have matched, or capped) — verify from screenshot" };
  return { status: "passed", note: "auto-check: app did not crash" };
}

function buildIamIosCases(): TmCase[] {
  return IAM_IOS_CASES.map((c) => ({
    id: c.id,
    key: c.key,
    title: c.title,
    description: "",
    suiteId: c.suiteId,
    priority: c.priority,
    automation: "manual",
    steps: c.steps,
    // EVERY iOS case is device-runnable ("ios-sim") — TMS "Run on device" launches
    // the Simulator via iam-ios/run-case.sh with the case's event, or an app-open
    // launch ("") when it has no specific custom event. The screenshot + state dump
    // are the evidence; the exit verdict is "app launched + synced + alive".
    tags: ["iam", "ios", "ios-sim", c.area.toLowerCase()],
    review: "approved",
    frameworkId: null,
    specFile: IAM_IOS_RUNNABLE[c.key] ?? "",
    lastRunStatus: "unexecuted",
    lastRunAt: null,
    runs: 0,
    source: "seed",
    createdBy: "TestPilot",
    createdAt: now(),
    updatedAt: now(),
    comments: [],
    history: [],
  }));
}

// Seed the iOS IAM suite (from the task/in-app branch, PR #51). Guarded by
// seq.iamIosSeed as a VERSION; only adds missing suites/cases.
// v2 (2026-08-12): mark the fire/launch-runnable iOS cases "ios-sim" + set specFile
// to the event, so TMS "Run on device" can run them on the Simulator (iam-ios framework).
// v3 (2026-08-13): make ALL iOS IAM cases device-runnable (not just the 9 with a
// custom event) — every case gets "ios-sim" + specFile = its event or "" (app-open),
// so "Run on device" launches the Simulator for any of them.
const IAM_IOS_SEED_VERSION = 3;
function backfillIamIos(p: Persisted): Persisted {
  if ((p.seq.iamIosSeed ?? 0) >= IAM_IOS_SEED_VERSION) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const addSuites = IAM_IOS_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = buildIamIosCases().filter((c) => !haveCases.has(c.id));
  // Re-tag EVERY already-seeded iOS case (key IAMIOS-*) so all become device-runnable.
  const retagged = p.cases.map((c) => {
    if (!c.key.startsWith("IAMIOS-")) return c;
    const ev = IAM_IOS_RUNNABLE[c.key] ?? "";
    if (c.tags.includes("ios-sim") && (c.specFile ?? "") === ev) return c;
    return { ...c, tags: c.tags.includes("ios-sim") ? c.tags : [...c.tags, "ios-sim"], specFile: ev };
  });
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...retagged, ...addCases],
    seq: { ...p.seq, iamIosSeed: IAM_IOS_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [
            { id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>IAM iOS — In-App Messaging</b> suite (${addCases.length} cases)` },
            ...p.activity,
          ]
        : p.activity,
  };
  save(next);
  return next;
}

// One-time: link the IAM cases that now have a Maestro flow (add a "maestro" tag +
// set specFile to the flow path) in an already-persisted install, so the board
// shows Maestro-covered vs pure-manual. Guarded by seq.iamMaestroSeed.
function backfillIamMaestro(p: Persisted): Persisted {
  if (p.seq.iamMaestroSeed) return p;
  let touched = 0;
  const cases = p.cases.map((c) => {
    const flow = IAM_MAESTRO_COVERAGE[c.key];
    if (!flow) return c;
    const hasTag = c.tags.includes("maestro");
    if (hasTag && c.specFile === flow) return c;
    touched++;
    return { ...c, tags: hasTag ? c.tags : [...c.tags, "maestro"], specFile: flow };
  });
  const next: Persisted = {
    ...p,
    cases,
    seq: { ...p.seq, iamMaestroSeed: 1 },
    activity: touched
      ? [{ id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Linked <b>${touched}</b> IAM cases to Maestro flows` }, ...p.activity]
      : p.activity,
  };
  save(next);
  return next;
}

// One-time: add Himshikhar's 2026-08-20 IAM device-QA batch (31 cases: the
// "close on tap outside" DISP-05..18 set + the numeric "120.0"->"120" TRIG/AUD/
// ACT/AN cases) onto an already-persisted install. Guarded by seq.iamDeviceSeed
// as a VERSION so bumping it re-adds new cases; only adds missing suites/cases.
const IAM_DEVICE_SEED_VERSION = 1;
function backfillIamDevice(p: Persisted): Persisted {
  if ((p.seq.iamDeviceSeed ?? 0) >= IAM_DEVICE_SEED_VERSION) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const addSuites = IAM_DEVICE_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = IAM_DEVICE_CASES.filter((c) => !haveCases.has(c.id));
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...p.cases, ...addCases],
    seq: { ...p.seq, iamDeviceSeed: IAM_DEVICE_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [
            { id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>IAM · Aug-2026 regression</b> suite (${addCases.length} device cases from Himshikhar's Asana batch)` },
            ...p.activity,
          ]
        : p.activity,
  };
  save(next);
  return next;
}

// One-time: add the QA cases authored from this session's Claude testing onto an
// already-persisted install. Each is id-guarded + idempotent and bumps its own seq
// VERSION so future additions re-run. LedgerPort PR #237 (QuickBooks Silver listing),
// the PushEngage Browser Extension audit, and the 2026-09 IAM Android build verify.
const LP_PR237_SEED_VERSION = 1;
function backfillLpPr237(p: Persisted): Persisted {
  if ((p.seq.lpPr237Seed ?? 0) >= LP_PR237_SEED_VERSION) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const addSuites = LP_PR237_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = LP_PR237_CASES.filter((c) => !haveCases.has(c.id));
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...p.cases, ...addCases],
    seq: { ...p.seq, lpPr237Seed: LP_PR237_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [{ id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>PR #237 · QuickBooks Silver listing</b> suite (${addCases.length} cases)` }, ...p.activity]
        : p.activity,
  };
  save(next);
  return next;
}

const EXT_SEED_VERSION = 1;
function backfillExtension(p: Persisted): Persisted {
  if ((p.seq.extSeed ?? 0) >= EXT_SEED_VERSION) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const addSuites = EXT_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = EXT_CASES.filter((c) => !haveCases.has(c.id));
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...p.cases, ...addCases],
    seq: { ...p.seq, extSeed: EXT_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [{ id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>PushEngage Browser Extension</b> suite (${addCases.length} cases)` }, ...p.activity]
        : p.activity,
  };
  save(next);
  return next;
}

const IAM_0917_SEED_VERSION = 1;
function backfillIam0917(p: Persisted): Persisted {
  if ((p.seq.iam0917Seed ?? 0) >= IAM_0917_SEED_VERSION) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const addSuites = IAM_0917_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = IAM_0917_CASES.filter((c) => !haveCases.has(c.id));
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...p.cases, ...addCases],
    seq: { ...p.seq, iam0917Seed: IAM_0917_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [{ id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>IAM · 2026-09 build verify</b> suite (${addCases.length} cases + 2 findings)` }, ...p.activity]
        : p.activity,
  };
  save(next);
  return next;
}

// Seed the Aug–Sep 2026 recent-QA suites/cases (LedgerPort + PushEngage: full
// regression, RC verifies, new-feature QA, author-issue verification) onto an
// already-persisted install. Guarded by seq.recentQaSeed as a VERSION; only adds
// missing suites/cases so a user-deleted case won't come back.
const RECENT_QA_SEED_VERSION = 1;
function backfillRecentQa(p: Persisted): Persisted {
  if ((p.seq.recentQaSeed ?? 0) >= RECENT_QA_SEED_VERSION) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const addSuites = RECENT_QA_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = RECENT_QA_CASES.filter((c) => !haveCases.has(c.id));
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...p.cases, ...addCases],
    seq: { ...p.seq, recentQaSeed: RECENT_QA_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [{ id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>Recent QA (Aug–Sep 2026)</b> — ${addSuites.length} suites, ${addCases.length} cases` }, ...p.activity]
        : p.activity,
  };
  save(next);
  return next;
}

// Seed the AI-onboarding QA suite (App Dashboard, PR #1014/#407 — live pass
// 2026-09-22) onto an already-persisted install. Guarded by seq.aiOnboardingSeed
// as a VERSION; only adds missing suites/cases so a user-deleted case won't return.
const AI_ONBOARDING_SEED_VERSION = 2;
function backfillAiOnboarding(p: Persisted): Persisted {
  if ((p.seq.aiOnboardingSeed ?? 0) >= AI_ONBOARDING_SEED_VERSION) return p;
  const haveSuites = new Set(p.suites.map((s) => s.id));
  const haveCases = new Set(p.cases.map((c) => c.id));
  const addSuites = AI_ONBOARDING_SUITES.filter((s) => !haveSuites.has(s.id));
  const addCases = AI_ONBOARDING_CASES.filter((c) => !haveCases.has(c.id));
  const next: Persisted = {
    ...p,
    suites: [...p.suites, ...addSuites],
    cases: [...p.cases, ...addCases],
    seq: { ...p.seq, aiOnboardingSeed: AI_ONBOARDING_SEED_VERSION },
    activity:
      addSuites.length || addCases.length
        ? [{ id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: `Added <b>App Dashboard · AI Onboarding</b> — ${addCases.length} cases (PR #1014/#407 live pass)` }, ...p.activity]
        : p.activity,
  };
  save(next);
  return next;
}

// ── Seed ─────────────────────────────────────────────────────────────────────
// One top-level suite per product (linked via productId so automated cases pick
// the right framework), plus a couple of example cases so the UI has shape.
function seed(): Persisted {
  const suites: TmSuite[] = products.map((p, i) => ({
    id: `suite-${p.id}`,
    name: p.name,
    parentId: null,
    productId: p.id,
    order: i,
  }));

  const mk = (
    n: number,
    suiteId: string,
    title: string,
    priority: TmPriority,
    automation: TmCase["automation"],
    frameworkId: string | null,
    steps: TmStep[],
    lastRunStatus: TmRunStatus = "unexecuted",
    tags: string[] = [],
  ): TmCase => ({
    id: `seedcase-${n}`,
    key: `TC-${n}`,
    title,
    description: "",
    suiteId,
    priority,
    automation,
    steps,
    tags,
    review: "approved",
    frameworkId,
    specFile: null,
    lastRunStatus,
    lastRunAt: null,
    runs: lastRunStatus === "unexecuted" ? 0 : 1,
    source: "seed",
    createdBy: "Kulvinder Singh",
    createdAt: now(),
    updatedAt: now(),
    comments: [],
    history: [],
  });

  const cases: TmCase[] = [
    mk(
      1,
      "suite-pe-site",
      "PushEngage marketing site loads",
      "high",
      "automated",
      "pushengage-site",
      [{ step: "Load https://www.pushengage.com/", expected: "Home page renders with hero + primary CTA, HTTP 200" }],
      "passed",
      ["smoke", "happy-path"],
    ),
    mk(
      2,
      "suite-pe-site",
      "Pricing page shows all plan tiers",
      "normal",
      "manual",
      null,
      [
        { step: "Open /pricing/", expected: "" },
        { step: "Compare plan columns", expected: "Free, Business, Premium tiers each show price + feature list" },
      ],
      "unexecuted",
      ["pricing"],
    ),
    mk(
      3,
      "suite-pe-app-dashboard",
      "Dashboard KPIs render after login",
      "high",
      "automated",
      "pushengage-app-dashboard",
      [{ step: "Sign in and open the dashboard", expected: "Subscriber + notification KPI tiles load without errors" }],
      "unexecuted",
      ["smoke"],
    ),
    mk(
      4,
      "suite-lp-dashboard",
      "LedgerPort sync completes for a test invoice",
      "critical",
      "automated",
      "ledgerport-saas-automation",
      [{ step: "Trigger a Shopify→QuickBooks sync for a seeded order", expected: "Invoice appears in QuickBooks sandbox, status = synced" }],
      "unexecuted",
      ["functional", "sync"],
    ),
  ];

  return {
    suites: [...suites, ...MOBILE_SDK_SUITES, ...IAM_ANDROID_SUITES, ...IAM_DEVICE_SUITES],
    cases: [...cases, ...buildMobileCases(), ...buildIamCases(), ...IAM_DEVICE_CASES],
    plans: [],
    executions: [],
    requirements: [],
    risks: [],
    releases: [],
    defects: [],
    activity: [
      { id: uid("act"), at: now(), by: "TestPilot", icon: "suite", html: "Seeded suites from the product catalog" },
    ],
    deviceRuns: [],
    perfRuns: [],
    seq: { case: 4, plan: 0, req: 0, risk: 0, release: 0, defect: 0, perf: 0, mobileSeed: 1, iamSeed: 3, iamMaestroSeed: 1, iamDeviceSeed: 1 },
  };
}

// Normalize a persisted blob (fill any missing collections for forward-compat) and
// run the idempotent one-time seed backfills. Used for BOTH the localStorage path
// (load) and the server path (hydrate).
function normalizeAndBackfill(p: Persisted): Persisted {
  const loaded: Persisted = {
    suites: p.suites ?? [],
    cases: p.cases ?? [],
    plans: p.plans ?? [],
    executions: p.executions ?? [],
    requirements: p.requirements ?? [],
    risks: p.risks ?? [],
    releases: p.releases ?? [],
    defects: p.defects ?? [],
    activity: p.activity ?? [],
    deviceRuns: p.deviceRuns ?? [],
    perfRuns: p.perfRuns ?? [],
    seq: { case: 0, plan: 0, req: 0, risk: 0, release: 0, defect: 0, perf: 0, ...(p.seq ?? {}) },
  };
  // One-time: add the mobile-SDK (Android/iOS) + IAM suites+cases to older installs,
  // then link the IAM cases that now have Maestro flows. Each is id-guarded + idempotent.
  return backfillAiOnboarding(backfillRecentQa(backfillIam0917(backfillExtension(backfillLpPr237(backfillIamDevice(backfillIamIos(backfillIamDash(backfillIamMaestro(backfillIam(backfillMobile(loaded)))))))))));
}

// Read the localStorage MIRROR (offline cache / server-down fallback). The shared
// source of truth is the server DB — see hydrate(). On an empty/corrupt mirror this
// seeds fresh (and writes the mirror).
function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (p && Array.isArray(p.suites)) return normalizeAndBackfill(p);
    }
  } catch {
    /* ignore — fall through to seed */
  }
  const s = seed();
  save(s);
  return s;
}

// Build a "lean" copy with screenshots stripped (data-URLs ~200KB — they persist
// durably server-side via server/deviceReports.ts, never in the TM blob).
function lean(p: Persisted): Persisted {
  return {
    ...p,
    cases: p.cases.map((c) =>
      c.history.some((h) => h.screenshot)
        ? { ...c, history: c.history.map((h) => (h.screenshot ? { ...h, screenshot: null } : h)) }
        : c,
    ),
    deviceRuns: p.deviceRuns.map((r) => ({ ...r, results: r.results.map((x) => (x.screenshot ? { ...x, screenshot: null } : x)) })),
  };
}

// Debounced push of the whole state to the shared server DB (the source of truth).
// The localStorage write (save) stays a same-write MIRROR — an offline cache and a
// safety net — so a server hiccup never loses data. Trailing 200ms collapses a burst
// of mutations into one POST.
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _pushNext: Persisted | null = null;
function pushToServer(p: Persisted) {
  _pushNext = p;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    const snap = _pushNext;
    _pushTimer = null;
    _pushNext = null;
    if (!snap) return;
    void saveTmState(lean(snap), "save").catch((e) => {
      // Server unreachable — the localStorage mirror already holds this write.
      console.warn("[tm] server save failed (localStorage mirror kept)", e);
    });
  }, 200);
}

// Persist to the localStorage MIRROR (immediate; offline cache + fallback).
function save(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lean(p)));
  } catch {
    /* localStorage unavailable — in-memory only */
  }
}

function mapPriority(p: Priority): TmPriority {
  return p === "High" ? "high" : p === "Low" ? "low" : "normal";
}

// A scenario → a case: its ordered steps become rows, the final row carries the
// scenario's expected result.
function scenarioToSteps(sc: TestScenario): TmStep[] {
  const steps = sc.steps.length ? sc.steps : [sc.title];
  return steps.map((step, i) => ({ step, expected: i === steps.length - 1 ? sc.expected : "" }));
}

// ── Run-poll for automated cases (self-contained; also drives the RunPanel) ───
const caseRunTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Cooperative cancel for a bulk (sequential) run — the runCases loop checks this
// between cases and stopBulkRun() flips it (plus cancels the in-flight runner run).
let bulkStop = false;

// V1 honest verdict → TM case status (+ the note shown in the case history /
// list: "Blocked by <cls>: <humanAction>" or "Passed with gaps: …").
function tmStatusFromVerdict(v: Verdict): { status: TmRunStatus; note?: string } {
  switch (v.state) {
    case "PASS":
      return { status: "passed" };
    case "PASS_WITH_GAPS":
      return { status: "passed", note: verdictNote(v) };
    case "FAIL":
      return { status: "failed", note: v.reason };
    case "NOT_RUN":
      return { status: "skipped", note: v.reason };
    default:
      return { status: "blocked", note: verdictNote(v) };
  }
}

type TmState = Persisted & {
  // transient
  aiBusy: boolean;
  aiError: string | null;
  runningCaseIds: string[];
  /** Progress of an active bulk (sequential) run, or null when idle. */
  runQueue: { total: number; done: number } | null;
  selectedSuiteId: string | null;
  /** Target environment for runner-backed case runs (Run / Run selected). Transient
   *  (NOT persisted) so it resets to "staging" every load — running against a live
   *  production store is always a conscious, per-session choice. Passed as the
   *  runner's `env`, which maps to the framework's envVar (e.g. SHOPIFY_ENV picks the
   *  staging vs production store/app). */
  runEnv: "staging" | "production";
  /** True once the shared server DB has been read into the store (or a fallback
   *  applied). TM screens gate on this so an un-hydrated (empty) store never flashes
   *  as "no cases". */
  hydrated: boolean;
  /** True when the server DB was unreachable and we fell back to the localStorage
   *  cache — changes are local-only until it's back. */
  serverDown: boolean;
  /** Read shared state from /api/tm; migrate localStorage → DB on a fresh DB; fall
   *  back to the localStorage cache if the server is down. Idempotent. */
  hydrate: () => Promise<void>;

  setSelectedSuite: (id: string | null) => void;
  setRunEnv: (env: "staging" | "production") => void;

  // suites
  addSuite: (name: string, parentId: string | null, productId?: string | null) => TmSuite;
  renameSuite: (id: string, name: string) => void;
  deleteSuite: (id: string) => void;
  moveSuite: (id: string, newParentId: string | null) => void;
  /** Clone a suite subtree (optionally its cases) under a target parent — the
   *  single-project analog of TestCollab's "Reusable Suites". */
  cloneSuite: (id: string, opts: { targetParentId: string | null; withCases: boolean }) => TmSuite | null;
  moveCases: (caseIds: string[], targetSuiteId: string) => void;

  // cases
  addCase: (input: Partial<TmCase> & { title: string; suiteId: string }) => TmCase;
  updateCase: (id: string, patch: Partial<TmCase>) => void;
  deleteCase: (id: string) => void;
  setCaseReview: (id: string, review: TmCase["review"]) => void;
  addCaseComment: (id: string, body: string) => void;
  setCaseStatus: (id: string, status: TmRunStatus, note?: string) => void;
  runCase: (id: string) => Promise<void>;
  /** Run many selected cases through the real runner, SEQUENTIALLY (the runner is
   *  one-at-a-time). Non-runnable ids (manual / no bound spec) are skipped. */
  runCases: (ids: string[]) => Promise<void>;
  /** Run a Maestro-covered manual case on the local emulator/device (runner
   *  "maestro" mode → run.sh <flow>). Only cases tagged "maestro" with a flow. */
  runCaseOnDevice: (id: string) => Promise<void>;
  /** Bulk on-device (Maestro) run of the selected cases, SEQUENTIALLY. Only
   *  Maestro-covered cases run; everything else in the selection is skipped. */
  runCasesOnDevice: (ids: string[]) => Promise<void>;
  /** Stop an in-flight bulk run after the current case + cancel the active run. */
  stopBulkRun: () => void;

  // QA Copilot
  generateCases: (opts: { suiteId: string; prompt: string; count?: number }) => Promise<number>;

  // Import real Playwright specs from a framework as automated cases.
  importFrameworkSpecs: (frameworkId: string) => Promise<{ added: number; updated: number; suites: number; bound?: number }>;

  /** V2a: merge the suites/cases the server upserted on a CONFIRMED Asana import
   *  (POST /api/tm/import/asana/:gid) into the open store, so the next save keeps them. */
  applyAsanaImport: (r: ImportApplied) => void;

  // plans + executions
  createPlan: (title: string, caseIds: string[], opts?: Partial<TmPlan>) => TmPlan;
  /** Build a test plan from a GitHub PR: deterministic checklist cases + auto-linked
   *  automated cases for the framework + best-effort AI-enriched scenarios. */
  createPlanFromPr: (pr: GithubPr, frameworkId: string | null) => Promise<TmPlan>;
  updatePlan: (id: string, patch: Partial<TmPlan>) => void;
  deletePlan: (id: string) => void;
  recordExecution: (planId: string, caseId: string, status: TmRunStatus, note?: string) => void;

  // requirements / risks / releases / defects
  addRequirement: (title: string, description: string, caseIds?: string[]) => TmRequirement;
  updateRequirement: (id: string, patch: Partial<TmRequirement>) => void;
  deleteRequirement: (id: string) => void;
  addRisk: (input: Omit<TmRisk, "id" | "key" | "createdAt">) => TmRisk;
  updateRisk: (id: string, patch: Partial<TmRisk>) => void;
  deleteRisk: (id: string) => void;
  addRelease: (name: string, date?: string | null) => TmRelease;
  updateRelease: (id: string, patch: Partial<TmRelease>) => void;
  deleteRelease: (id: string) => void;
  addDefect: (input: Partial<TmDefect> & { title: string }) => TmDefect;
  updateDefect: (id: string, patch: Partial<TmDefect>) => void;
  deleteDefect: (id: string) => void;

  // performance / load testing
  /** Run a load/perf test against one or more targets, persist the result as a
   *  TmPerfRun, and gate it pass/fail on the p95 budget + max error-rate. */
  startPerfRun: (input: PerfRunInput) => Promise<TmPerfRun>;
  deletePerfRun: (id: string) => void;
};

function emptyPersisted(): Persisted {
  return {
    suites: [], cases: [], plans: [], executions: [], requirements: [], risks: [],
    releases: [], defects: [], activity: [], deviceRuns: [], perfRuns: [],
    seq: { case: 0, plan: 0, req: 0, risk: 0, release: 0, defect: 0, perf: 0 },
  };
}

// The store boots EMPTY + un-hydrated; hydrate() (kicked off at the bottom of this
// file) fills it from the shared server DB (or the localStorage fallback). This is
// why load() is no longer the synchronous initial state.
const boot = emptyPersisted();

function persist(get: () => TmState) {
  const s = get();
  const p: Persisted = {
    suites: s.suites,
    cases: s.cases,
    plans: s.plans,
    executions: s.executions,
    requirements: s.requirements,
    risks: s.risks,
    releases: s.releases,
    defects: s.defects,
    activity: s.activity,
    deviceRuns: s.deviceRuns,
    perfRuns: s.perfRuns,
    seq: s.seq,
  };
  save(p); // localStorage mirror (immediate)
  if (s.hydrated) pushToServer(p); // shared server DB (debounced) — only after hydrate
}

export const useTm = create<TmState>((set, get) => {
  const logActivity = (icon: TmActivity["icon"], html: string) =>
    set((s) => ({ activity: [{ id: uid("act"), at: now(), by: actor(), icon, html }, ...s.activity].slice(0, 200) }));

  const nextKey = (kind: keyof Persisted["seq"], prefix: string) => {
    const n = (get().seq[kind] ?? 0) + 1;
    set((s) => ({ seq: { ...s.seq, [kind]: n } }));
    return `${prefix}-${n}`;
  };

  const after = () => persist(get);

  // Run ONE automated case end-to-end and resolve with its terminal verdict (or
  // null if it wasn't runnable / couldn't start). Shared core behind runCase
  // (single) and runCases (bulk): the runner is one-at-a-time server-side, so a
  // bulk run must await each case's verdict before starting the next. `silent`
  // suppresses the per-case start toast during a bulk run.
  const runOneCase = (id: string, opts?: { silent?: boolean; skipBusyGuard?: boolean; headed?: boolean }): Promise<TmRunStatus | null> =>
    new Promise((resolve) => {
      const c = get().cases.find((x) => x.id === id);
      const push = useStore.getState().pushToast;
      if (!c) return resolve(null);
      const framework = c.frameworkId;
      const spec = c.specFile;
      if (c.automation !== "automated" || !framework) {
        if (!opts?.silent)
          push({ icon: "issue", title: "Not an automated case", subtitle: "Set automation + a framework to run it" });
        return resolve(null);
      }
      // A case with no bound spec used to fall back to running the framework's
      // WHOLE smoke suite — slow and semantically wrong (the verdict written back
      // wouldn't reflect this one case). Require a bound spec instead.
      if (!spec) {
        if (!opts?.silent)
          push({
            icon: "issue",
            title: "No spec bound to this case",
            subtitle: "Import it from a framework or set a spec file — running one case shouldn't run the whole smoke suite",
          });
        return resolve(null);
      }
      // Single runs gate on the shared runnerRun mirror. A bulk run skips this:
      // its previous case already reached a terminal verdict via fetchRun (so the
      // SERVER slot is free), but the client mirror can lag a tick — gating on it
      // would falsely skip the next case. Instead the bulk path relies on the
      // server's authoritative 409 (handled with a short retry below).
      if (!opts?.skipBusyGuard && useStore.getState().runnerRun?.status === "running") {
        if (!opts?.silent)
          push({ icon: "issue", title: "A run is already in progress", subtitle: "Wait for it to finish" });
        return resolve(null);
      }

      void (async () => {
        let runId: string | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const { run } = await startRunnerRun({
              framework,
              mode: "spec",
              spec,
              // Target environment chosen on the Test Cases screen → the framework's
              // envVar (e.g. SHOPIFY_ENV=staging|production picks the store/app).
              env: get().runEnv,
              // Pin to one browser + no retries — one case should be a fast check,
              // not a 5–7× cross-browser fan-out (see server RunRequest.quick).
              quick: true,
              // Headed (visible browser) for small selections so the user can watch;
              // the caller (runCases/runCase) decides based on how many will run.
              headed: opts?.headed,
              taskRef: { label: `${c.key} · ${c.title} · ${get().runEnv}` },
            });
            runId = run.id;
            break;
          } catch (e) {
            // In a serialized bulk run a 409 ("a run is already in progress") just
            // means the previous run's slot hasn't fully cleared yet — wait briefly
            // and retry rather than dropping the case.
            if ((e as ApiError).status === 409 && opts?.skipBusyGuard && attempt < 3) {
              await new Promise((r) => setTimeout(r, 800));
              continue;
            }
            if (!opts?.silent) push({ icon: "issue", title: "Couldn't start run", subtitle: (e as Error).message });
            return resolve(null);
          }
        }
        if (!runId) return resolve(null);
        const rid: string = runId; // narrowed for the nested poll/finish closures
        // Show it live in the shared RunPanel (follows the currently-running case).
        try {
          useStore.getState().attachRunnerRun(rid);
        } catch {
          /* RunPanel optional */
        }
        set((s) => ({ runningCaseIds: [...s.runningCaseIds, id] }));
        if (!opts?.silent) push({ icon: "generate", title: `Running ${c.key}`, subtitle: c.title });

        const finish = (status: TmRunStatus, runId2: string, note?: string) => {
          const entry = { id: uid("hist"), status, at: now(), by: actor(), runId: runId2, ...(note ? { note } : {}) };
          set((s) => ({
            runningCaseIds: s.runningCaseIds.filter((x) => x !== id),
            cases: s.cases.map((x) =>
              x.id === id
                ? { ...x, lastRunStatus: status, lastRunAt: now(), runs: x.runs + 1, history: [entry, ...x.history] }
                : x,
            ),
          }));
          logActivity("run", `Automated run of <b>${c.key}</b> → ${status}${note ? ` (${note})` : ""}`);
          after();
          resolve(status);
        };

        const poll = async () => {
          try {
            const { run } = await fetchRun(rid, 0);
            if (run.status === "running") {
              caseRunTimers.set(id, setTimeout(poll, 1500));
              return;
            }
            // V1 honest verdict floor: the server's verdict decides. BLOCKED (0
            // executed, an @case skip, skip budget, a qa-core BlockedError) →
            // 'blocked' + "Blocked by <cls>: <human action>"; PASS_WITH_GAPS →
            // 'passed' + a gap note; NOT_RUN (cancelled) → 'skipped'.
            const v = run.verdict;
            if (v) {
              const mapped = tmStatusFromVerdict(v);
              finish(mapped.status, rid, mapped.note);
              return;
            }
            // Older server (no verdict): a Playwright run whose only outcome is
            // skips still exits 0 — never call that passed.
            const sum = run.summary;
            const nothingRan = !sum || (sum.expected === 0 && sum.unexpected === 0 && (sum.flaky ?? 0) === 0);
            const status: TmRunStatus =
              run.status === "passed"
                ? nothingRan
                  ? "blocked"
                  : "passed"
                : run.status === "failed"
                  ? "failed"
                  : run.status === "cancelled"
                    ? "skipped"
                    : "blocked";
            finish(status, rid, status === "blocked" && run.status === "passed" ? "Blocked by HARNESS: 0 tests executed" : undefined);
          } catch (e) {
            if ((e as ApiError).status === 404) {
              finish("blocked", rid);
              return;
            }
            caseRunTimers.set(id, setTimeout(poll, 2500));
          }
        };
        caseRunTimers.set(id, setTimeout(poll, 1200));
      })();
    });

  // Attach a started runner run to a case: show it live in the RunPanel, then poll
  // to a terminal verdict and write it back onto the case. Same shape as runOneCase's
  // tail; shared by the on-device (Maestro) path below.
  const trackCaseRun = (id: string, c: TmCase, rid: string, opts: { silent?: boolean } | undefined, resolve: (s: TmRunStatus | null) => void) => {
    try {
      useStore.getState().attachRunnerRun(rid);
    } catch {
      /* RunPanel optional */
    }
    set((s) => ({ runningCaseIds: [...s.runningCaseIds, id] }));
    if (!opts?.silent) useStore.getState().pushToast({ icon: "generate", title: `Running ${c.key}`, subtitle: c.title });
    const finish = (status: TmRunStatus, shot?: string | null, note?: string) => {
      const entry = { id: uid("hist"), status, at: now(), by: actor(), runId: rid, screenshot: shot ?? null, ...(note ? { note } : {}) };
      set((s) => ({
        runningCaseIds: s.runningCaseIds.filter((x) => x !== id),
        cases: s.cases.map((x) =>
          x.id === id ? { ...x, lastRunStatus: status, lastRunAt: now(), runs: x.runs + 1, history: [entry, ...x.history] } : x,
        ),
      }));
      logActivity("run", `On-device run of <b>${c.key}</b> → ${status}`);
      after();
      resolve(status);
    };
    const poll = async () => {
      try {
        const { run, output } = await fetchRun(rid, 0);
        if (run.status === "running") {
          caseRunTimers.set(id, setTimeout(poll, 2000));
          return;
        }
        if (run.status === "passed" && c.tags.includes("ios-sim")) {
          // App launched + no crash → derive an HONEST verdict from the state dump.
          const v = assessIosRun(c.key, output || "");
          finish(v.status, run.screenshot, v.note);
          return;
        }
        const status: TmRunStatus =
          run.status === "passed" ? "passed" : run.status === "failed" ? "failed" : run.status === "cancelled" ? "skipped" : "blocked";
        finish(status, run.screenshot);
      } catch (e) {
        if ((e as ApiError).status === 404) {
          finish("blocked");
          return;
        }
        caseRunTimers.set(id, setTimeout(poll, 2500));
      }
    };
    caseRunTimers.set(id, setTimeout(poll, 1500));
  };

  // Run a Maestro-covered IAM case on the local emulator/device via the runner's
  // "maestro" mode (iam-android framework → run.sh <flow>). Only cases tagged
  // "maestro" with a flow path in specFile are runnable this way (manual on-device
  // cases; NOT the Playwright runner). Mirrors runOneCase's start+retry.
  const runOneCaseOnDevice = (id: string, opts?: { silent?: boolean; skipBusyGuard?: boolean }): Promise<TmRunStatus | null> =>
    new Promise((resolve) => {
      const c = get().cases.find((x) => x.id === id);
      const push = useStore.getState().pushToast;
      if (!c) return resolve(null);
      // Two on-device kinds: Android (tag "maestro" → iam-android/run.sh <flow>) and
      // iOS Simulator (tag "ios-sim" → iam-ios/run-case.sh <event>).
      const isMaestro = c.tags.includes("maestro") && !!c.specFile;
      const isIos = c.tags.includes("ios-sim");
      if (!isMaestro && !isIos) {
        if (!opts?.silent)
          push({ icon: "issue", title: "Not device-runnable", subtitle: "Only Maestro (Android) or iOS-Simulator IAM cases run on device" });
        return resolve(null);
      }
      if (!opts?.skipBusyGuard && useStore.getState().runnerRun?.status === "running") {
        if (!opts?.silent) push({ icon: "issue", title: "A run is already in progress", subtitle: "Wait for it to finish" });
        return resolve(null);
      }
      // iOS: spec = the custom event ("" = app-open launch). Android: specFile is
      // repo-relative ("iam-android/automation/flows/x.yaml"); the runner's dir IS
      // …/iam-android/automation, so strip that prefix.
      const runReq = isIos
        ? { framework: "iam-ios", mode: "ios" as const, spec: c.specFile ?? "" }
        : { framework: "iam-android", mode: "maestro" as const, spec: (c.specFile ?? "").replace(/^iam-android\/automation\//, "") };
      void (async () => {
        let runId: string | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const { run } = await startRunnerRun({
              framework: runReq.framework,
              mode: runReq.mode,
              spec: runReq.spec,
              taskRef: { label: `${c.key} · ${c.title} · on-device` },
            });
            runId = run.id;
            break;
          } catch (e) {
            if ((e as ApiError).status === 409 && opts?.skipBusyGuard && attempt < 3) {
              await new Promise((r) => setTimeout(r, 800));
              continue;
            }
            if (!opts?.silent) push({ icon: "issue", title: "Couldn't start device run", subtitle: (e as Error).message });
            return resolve(null);
          }
        }
        if (!runId) return resolve(null);
        trackCaseRun(id, c, runId, opts, resolve);
      })();
    });

  // Build + persist an on-device run report from the cases' latest result
  // (history[0] carries the screenshot). In-memory deviceRuns keeps the images;
  // the server store (server/deviceReports.ts) keeps them durably across reloads.
  const recordDeviceRun = (caseIds: string[], label: string) => {
    const cases = get().cases;
    const results: TmDeviceRunResult[] = caseIds
      .map((cid) => cases.find((c) => c.id === cid))
      .filter((c): c is TmCase => !!c)
      .map((c) => ({
        caseId: c.id,
        key: c.key,
        title: c.title,
        status: c.lastRunStatus,
        screenshot: c.history[0]?.screenshot ?? null,
      }));
    if (!results.length) return;
    const passed = results.filter((r) => r.status === "passed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const report: TmDeviceRun = {
      id: uid("devrun"),
      at: now(),
      by: actor(),
      label,
      total: results.length,
      passed,
      failed,
      results,
    };
    set((s) => ({ deviceRuns: [report, ...s.deviceRuns].slice(0, 60) }));
    after();
    void saveDeviceReport(report).catch(() => {}); // durable, best-effort
  };

  return {
    ...boot,
    aiBusy: false,
    aiError: null,
    runningCaseIds: [],
    runQueue: null,
    selectedSuiteId: null,
    runEnv: "staging",
    hydrated: false,
    serverDown: false,

    setSelectedSuite: (id) => set({ selectedSuiteId: id }),
    setRunEnv: (env) => set({ runEnv: env }),

    hydrate: async () => {
      if (get().hydrated) return;
      const server = await fetchTmState();
      let localRaw: string | null = null;
      try {
        localRaw = localStorage.getItem(KEY);
      } catch {
        /* no localStorage */
      }
      let local: Persisted | null = null;
      try {
        local = localRaw ? (JSON.parse(localRaw) as Persisted) : null;
      } catch {
        /* corrupt mirror */
      }
      const localOk = !!local && Array.isArray(local.suites);

      // Server unreachable → degrade to the localStorage cache (today's behavior).
      if (!server) {
        set({ ...load(), hydrated: true, serverDown: true });
        return;
      }
      // Fresh server DB → migrate the current localStorage blob into it (or seed).
      if (server.state === null) {
        const base = load();
        set({ ...base, hydrated: true, serverDown: false });
        try {
          await saveTmState(lean(base), localOk ? "migrate-localStorage" : "seed");
        } catch (e) {
          console.warn("[tm] initial server save failed", e);
        }
        return;
      }
      // Server has data (source of truth). Prefer a localStorage mirror that is
      // AHEAD (a last write that didn't reach the server before a close), else the
      // server; then run idempotent backfills so new seed additions land once.
      const srvBase = normalizeAndBackfill(server.state as Persisted);
      const chosen = localOk && (local!.cases?.length ?? 0) > srvBase.cases.length ? normalizeAndBackfill(local!) : srvBase;
      set({ ...chosen, hydrated: true, serverDown: false });
      save(chosen); // refresh the localStorage mirror
      if (chosen.cases.length !== server.cases) {
        try {
          await saveTmState(lean(chosen), "hydrate-reconcile");
        } catch (e) {
          console.warn("[tm] reconcile push failed", e);
        }
      }
    },

    // ── Suites ────────────────────────────────────────────────────────────
    addSuite: (name, parentId, productId) => {
      const suite: TmSuite = { id: uid("suite"), name, parentId, productId: productId ?? null, order: get().suites.length };
      set((s) => ({ suites: [...s.suites, suite] }));
      logActivity("suite", `Created suite <b>${name}</b>`);
      after();
      return suite;
    },
    renameSuite: (id, name) => {
      set((s) => ({ suites: s.suites.map((x) => (x.id === id ? { ...x, name } : x)) }));
      after();
    },
    deleteSuite: (id) => {
      // Also drop descendant suites + their cases.
      const all = get().suites;
      const toDelete = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const su of all) {
          if (su.parentId && toDelete.has(su.parentId) && !toDelete.has(su.id)) {
            toDelete.add(su.id);
            grew = true;
          }
        }
      }
      set((s) => ({
        suites: s.suites.filter((x) => !toDelete.has(x.id)),
        cases: s.cases.filter((c) => !toDelete.has(c.suiteId)),
      }));
      after();
    },
    moveSuite: (id, newParentId) => {
      // Guard against cycles: can't move a suite under itself/a descendant.
      const all = get().suites;
      const banned = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const su of all) {
          if (su.parentId && banned.has(su.parentId) && !banned.has(su.id)) {
            banned.add(su.id);
            grew = true;
          }
        }
      }
      if (newParentId && banned.has(newParentId)) return;
      set((s) => ({ suites: s.suites.map((x) => (x.id === id ? { ...x, parentId: newParentId } : x)) }));
      after();
    },
    cloneSuite: (id, { targetParentId, withCases }) => {
      const all = get().suites;
      const src = all.find((s) => s.id === id);
      if (!src) return null;
      // Collect the subtree (BFS) preserving parent relationships.
      const subtree: TmSuite[] = [];
      const queue = [src];
      while (queue.length) {
        const cur = queue.shift() as TmSuite;
        subtree.push(cur);
        queue.push(...all.filter((s) => s.parentId === cur.id));
      }
      const idMap = new Map<string, string>();
      let order = get().suites.length;
      const clonedSuites: TmSuite[] = subtree.map((s) => {
        const newId = uid("suite");
        idMap.set(s.id, newId);
        return { ...s, id: newId, order: order++ };
      });
      // Re-point parents; the root's parent becomes targetParentId; suffix root name.
      const rootNewId = idMap.get(src.id)!;
      const rewired = clonedSuites.map((s) =>
        s.id === rootNewId
          ? { ...s, parentId: targetParentId, name: `${s.name} (copy)` }
          : { ...s, parentId: s.parentId ? idMap.get(s.parentId) ?? null : null },
      );

      let clonedCases: TmCase[] = [];
      if (withCases) {
        const srcCases = get().cases.filter((c) => idMap.has(c.suiteId));
        clonedCases = srcCases.map((c) => {
          const key = nextKey("case", "TC");
          return {
            ...c,
            id: uid("case"),
            key,
            suiteId: idMap.get(c.suiteId)!,
            lastRunStatus: "unexecuted" as TmRunStatus,
            lastRunAt: null,
            runs: 0,
            history: [],
            comments: [],
            source: "manual" as const,
            createdAt: now(),
            updatedAt: now(),
          };
        });
      }
      set((s) => ({ suites: [...s.suites, ...rewired], cases: [...s.cases, ...clonedCases] }));
      logActivity("suite", `Cloned suite <b>${src.name}</b>${withCases ? ` with ${clonedCases.length} cases` : ""}`);
      after();
      return rewired.find((s) => s.id === rootNewId) ?? null;
    },
    moveCases: (caseIds, targetSuiteId) => {
      const set0 = new Set(caseIds);
      set((s) => ({ cases: s.cases.map((c) => (set0.has(c.id) ? { ...c, suiteId: targetSuiteId, updatedAt: now() } : c)) }));
      after();
    },

    // ── Cases ─────────────────────────────────────────────────────────────
    addCase: (input) => {
      const key = nextKey("case", "TC");
      const c: TmCase = {
        id: uid("case"),
        key,
        title: input.title,
        description: input.description ?? "",
        suiteId: input.suiteId,
        priority: input.priority ?? "normal",
        automation: input.automation ?? "manual",
        steps: input.steps ?? [{ step: "", expected: "" }],
        tags: input.tags ?? [],
        review: input.review ?? "draft",
        frameworkId: input.frameworkId ?? null,
        specFile: input.specFile ?? null,
        lastRunStatus: "unexecuted",
        lastRunAt: null,
        runs: 0,
        source: input.source ?? "manual",
        createdBy: actor(),
        createdAt: now(),
        updatedAt: now(),
        comments: [],
        history: [],
      };
      set((s) => ({ cases: [...s.cases, c] }));
      logActivity("case", `Added test case <b>${c.key}</b> — ${c.title}`);
      after();
      return c;
    },
    updateCase: (id, patch) => {
      set((s) => ({ cases: s.cases.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now() } : c)) }));
      after();
    },
    deleteCase: (id) => {
      set((s) => ({ cases: s.cases.filter((c) => c.id !== id) }));
      after();
    },
    setCaseReview: (id, review) => {
      set((s) => ({ cases: s.cases.map((c) => (c.id === id ? { ...c, review, updatedAt: now() } : c)) }));
      after();
    },
    addCaseComment: (id, body) => {
      const comment = { id: uid("cmt"), author: actor(), body, at: now() };
      set((s) => ({ cases: s.cases.map((c) => (c.id === id ? { ...c, comments: [...c.comments, comment] } : c)) }));
      after();
    },
    setCaseStatus: (id, status, note) => {
      const entry = { id: uid("hist"), status, at: now(), by: actor(), note };
      set((s) => ({
        cases: s.cases.map((c) =>
          c.id === id
            ? { ...c, lastRunStatus: status, lastRunAt: now(), runs: c.runs + 1, history: [entry, ...c.history] }
            : c,
        ),
      }));
      logActivity("run", `Marked <b>${get().cases.find((c) => c.id === id)?.key}</b> ${status}`);
      after();
    },

    // A single "Run" is one case (≤10) → headed so it's watchable.
    runCase: (id) => runOneCase(id, { headed: true }).then(() => undefined),

    runCases: async (ids) => {
      const push = useStore.getState().pushToast;
      if (useStore.getState().runnerRun?.status === "running") {
        push({ icon: "issue", title: "A run is already in progress", subtitle: "Wait for it to finish" });
        return;
      }
      const all = get().cases;
      const runnable = ids
        .map((id) => all.find((c) => c.id === id))
        .filter((c): c is TmCase => !!c && c.automation === "automated" && !!c.frameworkId && !!c.specFile);
      const notRunnable = ids.length - runnable.length;
      if (runnable.length === 0) {
        push({
          icon: "issue",
          title: "Nothing runnable selected",
          subtitle: "Only automated cases with a bound spec can run — import them from a framework",
        });
        return;
      }

      bulkStop = false;
      // Small selections run HEADED (visible) so the user can watch what executes;
      // larger batches (>10 runnable) run headless to avoid a flurry of windows.
      const headed = runnable.length <= 10;
      set({ runQueue: { total: runnable.length, done: 0 } });
      push({
        icon: "generate",
        title: `Running ${runnable.length} case${runnable.length === 1 ? "" : "s"}`,
        subtitle: `${headed ? "Headed — watch the browser" : "Headless"} · one at a time${notRunnable > 0 ? ` · ${notRunnable} non-runnable skipped` : ""}`,
      });

      const tally: Record<TmRunStatus, number> = { unexecuted: 0, passed: 0, failed: 0, skipped: 0, blocked: 0 };
      for (const c of runnable) {
        if (bulkStop) break;
        const status = await runOneCase(c.id, { silent: true, skipBusyGuard: true, headed });
        if (status) tally[status] += 1;
        set((s) => (s.runQueue ? { runQueue: { ...s.runQueue, done: s.runQueue.done + 1 } } : {}));
      }

      const stopped = bulkStop;
      bulkStop = false;
      set({ runQueue: null });
      const parts = [`${tally.passed} passed`, `${tally.failed} failed`, `${tally.skipped} skipped`];
      if (tally.blocked) {
        // V1: name the first blocker so "blocked" is actionable, not a mystery count.
        const ids = new Set(runnable.map((c) => c.id));
        const firstNote = get()
          .cases.filter((c) => ids.has(c.id) && c.lastRunStatus === "blocked")
          .map((c) => c.history[0]?.note)
          .find(Boolean);
        parts.push(`${tally.blocked} blocked${firstNote ? ` (${firstNote})` : ""}`);
      }
      logActivity("run", `Bulk run of ${runnable.length} cases → ${parts.join(", ")}`);
      push({
        icon: stopped ? "sync" : tally.failed > 0 ? "issue" : "check",
        title: stopped ? "Bulk run stopped" : "Bulk run complete",
        subtitle: parts.join(" · "),
      });
    },

    runCaseOnDevice: (id) =>
      runOneCaseOnDevice(id).then((status) => {
        if (status) {
          const c = get().cases.find((x) => x.id === id);
          recordDeviceRun([id], c ? `${c.key} · ${c.title}` : "Device run");
        }
      }),

    runCasesOnDevice: async (ids) => {
      const push = useStore.getState().pushToast;
      if (useStore.getState().runnerRun?.status === "running") {
        push({ icon: "issue", title: "A run is already in progress", subtitle: "Wait for it to finish" });
        return;
      }
      const all = get().cases;
      // Device-runnable = Android Maestro cases (tag "maestro" + a flow in specFile)
      // OR iOS-Simulator cases (tag "ios-sim"). Manual / non-device cases in the
      // selection are skipped — so "Run on device" only touches the IAM device cases.
      const runnable = ids
        .map((id) => all.find((c) => c.id === id))
        .filter((c): c is TmCase => !!c && ((c.tags.includes("maestro") && !!c.specFile) || c.tags.includes("ios-sim")));
      const notRunnable = ids.length - runnable.length;
      if (runnable.length === 0) {
        push({ icon: "issue", title: "No device-runnable cases selected", subtitle: "Only Maestro (Android) / iOS-Simulator IAM cases run on device" });
        return;
      }
      bulkStop = false;
      set({ runQueue: { total: runnable.length, done: 0 } });
      push({
        icon: "generate",
        title: `Running ${runnable.length} on device`,
        subtitle: notRunnable > 0 ? `${notRunnable} non-device skipped · one at a time` : "Sequential — one at a time",
      });
      const tally: Record<TmRunStatus, number> = { unexecuted: 0, passed: 0, failed: 0, skipped: 0, blocked: 0 };
      for (const c of runnable) {
        if (bulkStop) break;
        const status = await runOneCaseOnDevice(c.id, { silent: true, skipBusyGuard: true });
        if (status) tally[status] += 1;
        set((s) => (s.runQueue ? { runQueue: { ...s.runQueue, done: s.runQueue.done + 1 } } : {}));
      }
      const stopped = bulkStop;
      bulkStop = false;
      set({ runQueue: null });
      recordDeviceRun(runnable.map((c) => c.id), `IAM device · ${runnable.length} case${runnable.length > 1 ? "s" : ""}`);
      const parts = [`${tally.passed} passed`, `${tally.failed} failed`, `${tally.skipped} skipped`];
      if (tally.blocked) parts.push(`${tally.blocked} blocked`);
      logActivity("run", `On-device run of ${runnable.length} cases → ${parts.join(", ")}`);
      push({
        icon: stopped ? "sync" : tally.failed > 0 ? "issue" : "check",
        title: stopped ? "Device run stopped" : "Device run complete",
        subtitle: parts.join(" · "),
      });
    },

    stopBulkRun: () => {
      bulkStop = true;
      const active = useStore.getState().runnerRun;
      if (active && active.status === "running") void cancelRunnerRun(active.id).catch(() => {});
    },

    // ── QA Copilot ──────────────────────────────────────────────────────────
    generateCases: async ({ suiteId, prompt, count }) => {
      set({ aiBusy: true, aiError: null });
      const suite = get().suites.find((s) => s.id === suiteId);
      const product = products.find((p) => p.id === suite?.productId);
      const framework = product ? defaultFrameworkFor(product.id, product.brand) : undefined;
      const input: PlanInput = {
        title: prompt.slice(0, 120),
        description: prompt,
        type: "Feature",
        priority: "Medium",
        brand: product?.brand,
        productName: product?.name,
        origin: "manual",
        defaultFrameworkId: framework,
      };
      try {
        const { plan } = await aiPlanTask(input);
        const { scenarios } = await aiScenarios(input, plan);
        const chosen = typeof count === "number" ? scenarios.slice(0, count) : scenarios;
        const created: TmCase[] = chosen.map((sc) => {
          const key = nextKey("case", "TC");
          return {
            id: uid("case"),
            key,
            title: sc.title,
            description: `${sc.area} · ${sc.type}`,
            suiteId,
            priority: mapPriority(sc.priority),
            automation: framework ? "automated" : "manual",
            steps: scenarioToSteps(sc),
            tags: [sc.area, sc.type],
            review: "pending",
            frameworkId: framework ?? null,
            specFile: null,
            lastRunStatus: "unexecuted",
            lastRunAt: null,
            runs: 0,
            source: "copilot",
            createdBy: actor(),
            createdAt: now(),
            updatedAt: now(),
            comments: [],
            history: [],
          };
        });
        set((s) => ({ cases: [...s.cases, ...created], aiBusy: false }));
        logActivity("copilot", `QA Copilot generated <b>${created.length}</b> cases into ${suite?.name ?? "a suite"}`);
        after();
        return created.length;
      } catch (e) {
        const msg = (e as Error).message || "Generation failed";
        set({ aiBusy: false, aiError: msg });
        useStore.getState().pushToast({ icon: "issue", title: "QA Copilot failed", subtitle: msg });
        return 0;
      }
    },

    // ── Import real framework specs as automated cases ──────────────────────
    importFrameworkSpecs: async (frameworkId) => {
      const fw = TM_FRAMEWORKS.find((f) => f.id === frameworkId);
      const label = fw?.label ?? frameworkId;
      let specs;
      try {
        const resp = await fetchSpecs(frameworkId, false);
        specs = resp.specs || [];
      } catch (e) {
        useStore.getState().pushToast({ icon: "issue", title: `Couldn't list ${label} specs`, subtitle: (e as Error).message });
        return { added: 0, updated: 0, suites: 0 };
      }
      if (!specs.length) {
        useStore.getState().pushToast({ icon: "issue", title: `No specs in ${label}`, subtitle: "Nothing to import" });
        return { added: 0, updated: 0, suites: 0 };
      }

      const productId = FRAMEWORK_PRODUCT[frameworkId] ?? null;
      const state = get();
      const suites = [...state.suites];
      const cases = [...state.cases];
      let seqCase = state.seq.case ?? 0;
      let added = 0;
      let updated = 0;
      let newSuites = 0;

      // Root suite: reuse the seed product suite, else a framework-named one.
      let root = suites.find((s) => (productId && s.productId === productId) || s.id === `suite-fw-${frameworkId}`);
      if (!root) {
        root = { id: `suite-fw-${frameworkId}`, name: label, parentId: null, productId, order: suites.length };
        suites.push(root);
        newSuites++;
      }
      const rootId = root.id;

      const sanitize = (s: string) => s.replace(/[^\w.-]/g, "_");
      const dirOf = (f: string) => { const i = f.lastIndexOf("/"); return i >= 0 ? f.slice(0, i) : "tests"; };
      const baseOf = (f: string) => { const i = f.lastIndexOf("/"); return i >= 0 ? f.slice(i + 1) : f; };
      const stripTags = (t: string) => t.replace(/\s*@[\w:-]+/g, "").trim() || t;

      const ensureDirSuite = (dir: string) => {
        const id = `imp-suite-${sanitize(frameworkId)}-${sanitize(dir)}`;
        if (!suites.some((s) => s.id === id)) {
          suites.push({ id, name: dir, parentId: rootId, productId, order: suites.length });
          newSuites++;
        }
        return id;
      };

      // V2a @case mapping: a spec whose title or tags carry `@case:<KEY>` binds to the
      // TM case with that caseKey (externalRef.caseKey, else the display key) instead
      // of importing an imp- duplicate. Unmatched keys fall through to a normal import.
      let boundByKey = 0;
      const boundIds = new Set<string>();
      for (const sp of specs) {
        const keys = caseKeysFromSpec(sp.title, sp.tags);
        if (keys.length) {
          let any = false;
          for (const k of keys) {
            const i = cases.findIndex((c) => !c.id.startsWith("imp-") && (c.externalRef?.caseKey === k || c.key === k));
            if (i < 0) continue;
            any = true;
            if (boundIds.has(cases[i].id)) continue; // first spec carrying the key wins
            boundIds.add(cases[i].id);
            cases[i] = { ...cases[i], automation: "automated", frameworkId, specFile: `${sp.file}:${sp.line}`, updatedAt: now() };
            boundByKey++;
          }
          if (any) {
            updated++;
            continue;
          }
        }
        // A documented (seeded) case already bound to this exact test — its title is
        // prefixed with the case key — stays the single source: refresh its line
        // instead of importing a duplicate imp- case.
        const bound = cases.findIndex(
          (c) =>
            !c.id.startsWith("imp-") &&
            c.frameworkId === frameworkId &&
            !!c.specFile &&
            c.specFile.replace(/:\d+$/, "") === sp.file &&
            stripTags(sp.title).startsWith(c.key),
        );
        if (bound >= 0) {
          cases[bound] = { ...cases[bound], specFile: `${sp.file}:${sp.line}`, updatedAt: now() };
          updated++;
          continue;
        }
        const suiteId = ensureDirSuite(dirOf(sp.file));
        const id = `imp-${sanitize(frameworkId)}-${sanitize(sp.file)}-${sp.line}`;
        const specFile = `${sp.file}:${sp.line}`;
        const title = stripTags(sp.title);
        const idx = cases.findIndex((c) => c.id === id);
        if (idx >= 0) {
          cases[idx] = {
            ...cases[idx],
            title,
            suiteId,
            automation: "automated",
            frameworkId,
            specFile,
            tags: sp.tags ?? [],
            updatedAt: now(),
          };
          updated++;
        } else {
          seqCase++;
          cases.push({
            id,
            key: `TC-${seqCase}`,
            title,
            description: baseOf(sp.file),
            suiteId,
            priority: "normal",
            automation: "automated",
            steps: [{ step: `Execute ${specFile}`, expected: "Test passes" }],
            tags: sp.tags ?? [],
            review: "approved",
            frameworkId,
            specFile,
            lastRunStatus: "unexecuted",
            lastRunAt: null,
            runs: 0,
            source: "manual",
            createdBy: actor(),
            createdAt: now(),
            updatedAt: now(),
            comments: [],
            history: [],
          });
          added++;
        }
      }

      set({ suites, cases, seq: { ...state.seq, case: seqCase } });
      logActivity("case", `Imported <b>${added}</b> case${added === 1 ? "" : "s"} from <b>${label}</b>${updated ? ` (updated ${updated})` : ""}${boundByKey ? ` · ${boundByKey} bound by @case` : ""}`);
      after();
      return { added, updated, suites: newSuites, bound: boundByKey };
    },

    applyAsanaImport: (r) => {
      if (!r || r.mode !== "applied") return;
      set((s) => {
        const suites = [...s.suites];
        for (const su of r.suites || []) {
          const i = suites.findIndex((x) => x.id === su.id);
          if (i >= 0) suites[i] = su;
          else suites.push(su);
        }
        const cases = [...s.cases];
        for (const c of r.cases || []) {
          const i = cases.findIndex((x) => x.id === c.id);
          if (i < 0) cases.push(c);
          // A bound (non-Asana-sourced, e.g. seeded) case: the server only attached
          // externalRef + the asana tag, so merge just those onto THIS tab's copy —
          // replacing it wholesale could drop an edit not yet pushed to the server.
          else if (c.source !== "asana")
            cases[i] = { ...cases[i], externalRef: c.externalRef, tags: [...new Set([...(cases[i].tags || []), ...(c.tags || [])])], updatedAt: c.updatedAt };
          else cases[i] = c;
        }
        const seqCase = Math.max(s.seq.case ?? 0, r.seq?.case ?? 0);
        const activity = r.activity && !s.activity.some((a) => a.id === r.activity!.id) ? [r.activity, ...s.activity].slice(0, 200) : s.activity;
        return { suites, cases, activity, seq: { ...s.seq, case: seqCase } };
      });
      after();
    },

    // ── Plans + executions ────────────────────────────────────────────────
    createPlan: (title, caseIds, opts) => {
      const key = nextKey("plan", "TP");
      const plan: TmPlan = {
        id: uid("plan"),
        key,
        title,
        caseIds,
        releaseId: opts?.releaseId ?? null,
        priority: opts?.priority ?? "normal",
        status: opts?.status ?? "active",
        assignedTo: opts?.assignedTo ?? null,
        createdBy: actor(),
        createdAt: now(),
        prUrl: opts?.prUrl ?? null,
        prRepo: opts?.prRepo ?? null,
        prNumber: opts?.prNumber ?? null,
      };
      set((s) => ({ plans: [plan, ...s.plans] }));
      logActivity("plan", `Created test plan <b>${plan.key}</b> — ${title} (${caseIds.length} cases)`);
      after();
      return plan;
    },

    createPlanFromPr: async (pr, frameworkId) => {
      // A dedicated top-level suite holds the PR-checklist (manual) cases.
      let prSuite = get().suites.find((s) => s.name === "PR Reviews" && s.parentId === null);
      if (!prSuite) prSuite = get().addSuite("PR Reviews", null, null);

      // Derive changed AREAS from the PR's files (skip generic path prefixes).
      const GENERIC = new Set(["src", "app", "lib", "tests", "test", "components", "pages", "screens", "assets", "public", "dist", "packages", "source"]);
      const areaSet = new Set<string>();
      for (const f of pr.files) {
        const parts = (f.filename || "").split("/").filter(Boolean);
        let area = parts.find((p, i) => i < parts.length - 1 && !GENERIC.has(p.toLowerCase()));
        if (!area) area = parts.length > 1 ? parts[0] : (parts[0] || "").replace(/\.[^.]+$/, "");
        area = (area || "").replace(/\.[^.]+$/, "").trim();
        if (area) areaSet.add(area);
      }
      const areas = [...areaSet].slice(0, 6);

      const desc = `Affected by PR #${pr.number} — ${pr.title}`.slice(0, 160);
      const mk = (title: string, tags: string[], steps: { step: string; expected: string }[]) =>
        get().addCase({
          title: title.slice(0, 140),
          description: desc,
          suiteId: prSuite!.id,
          automation: "manual",
          priority: "high",
          tags: ["pr-review", `pr-${pr.number}`, ...tags],
          review: "pending",
          source: "manual",
          frameworkId,
          steps,
        });

      const checklist: TmCase[] = [
        mk(`PR #${pr.number}: intended change works`, [], [
          { step: `Exercise the change described in PR #${pr.number} — "${pr.title}"`, expected: "Behaves per the PR's stated intent" },
          { step: "Watch the browser console + network during the flow", expected: "No new JS errors or failed requests" },
        ]),
        ...areas.map((area) =>
          mk(`PR #${pr.number}: regression — ${area}`, [area], [
            { step: `Smoke the "${area}" area touched by this PR`, expected: "Existing behavior unchanged (no regression)" },
          ]),
        ),
      ];

      // Auto-link existing AUTOMATED cases for the framework → the plan is
      // immediately runnable against real specs, not just the manual checklist.
      const autoLinked = frameworkId
        ? get().cases.filter((c) => c.frameworkId === frameworkId && c.automation === "automated").slice(0, 40).map((c) => c.id)
        : [];

      const caseIds = [...checklist.map((c) => c.id), ...autoLinked];
      const plan = get().createPlan(`PR #${pr.number} — ${pr.title}`.slice(0, 120), caseIds, {
        priority: "high",
        prUrl: pr.url,
        prRepo: pr.url.match(/github\.com\/([^/]+\/[^/]+)\//)?.[1] ?? null,
        prNumber: pr.number,
      });
      logActivity("plan", `Built test plan <b>${plan.key}</b> from PR #${pr.number} — ${areas.length} area(s) + ${autoLinked.length} automated case(s)`);

      // Best-effort AI enrichment — adds PR-aware scenarios when Anthropic credits
      // exist. Silent no-op on the 402 credit gate (the deterministic plan stands).
      try {
        const product = products.find((p) => defaultFrameworkFor(p.id, p.brand) === frameworkId);
        const input: PlanInput = {
          title: pr.title,
          description: pr.body?.slice(0, 4000) || pr.title,
          type: "Feature",
          priority: "High",
          brand: product?.brand,
          productName: product?.name,
          origin: "github",
          pr: pr.number,
          links: { pullRequest: pr.url },
          defaultFrameworkId: frameworkId ?? undefined,
        };
        const { plan: aiPlan } = await aiPlanTask(input);
        const { scenarios } = await aiScenarios(input, aiPlan);
        const aiCases = scenarios.slice(0, 12).map((sc) =>
          get().addCase({
            title: sc.title,
            description: `${sc.area} · ${sc.type} · PR #${pr.number}`,
            suiteId: prSuite!.id,
            automation: frameworkId ? "automated" : "manual",
            priority: mapPriority(sc.priority),
            steps: scenarioToSteps(sc),
            tags: ["pr-review", `pr-${pr.number}`, sc.area, sc.type],
            review: "pending",
            source: "copilot",
            frameworkId,
          }),
        );
        if (aiCases.length) {
          const cur = get().plans.find((p) => p.id === plan.id)?.caseIds ?? caseIds;
          get().updatePlan(plan.id, { caseIds: [...cur, ...aiCases.map((c) => c.id)] });
          logActivity("copilot", `AI enriched ${plan.key} with <b>${aiCases.length}</b> PR-aware scenarios`);
        }
      } catch (e) {
        const msg = (e as Error).message || "";
        if (/credit|payment required|\b402\b|billing|insufficient|quota|no funds/i.test(msg)) useStore.setState({ aiUnfunded: true });
        // AI enrichment is best-effort; the deterministic plan is already the result.
      }

      return get().plans.find((p) => p.id === plan.id) ?? plan;
    },
    updatePlan: (id, patch) => {
      set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      after();
    },
    deletePlan: (id) => {
      set((s) => ({ plans: s.plans.filter((p) => p.id !== id), executions: s.executions.filter((e) => e.planId !== id) }));
      after();
    },
    recordExecution: (planId, caseId, status, note) => {
      const exec: TmExecution = {
        id: uid("exec"),
        planId,
        caseId,
        status,
        note,
        executedBy: actor(),
        executedAt: now(),
      };
      const entry = { id: uid("hist"), status, at: now(), by: actor(), note };
      set((s) => ({
        executions: [exec, ...s.executions],
        cases: s.cases.map((c) =>
          c.id === caseId
            ? { ...c, lastRunStatus: status, lastRunAt: now(), runs: c.runs + 1, history: [entry, ...c.history] }
            : c,
        ),
      }));
      after();
    },

    // ── Requirements ──────────────────────────────────────────────────────
    addRequirement: (title, description, caseIds) => {
      const req: TmRequirement = { id: uid("req"), key: nextKey("req", "REQ"), title, description, caseIds: caseIds ?? [], createdAt: now() };
      set((s) => ({ requirements: [req, ...s.requirements] }));
      logActivity("requirement", `Added requirement <b>${req.key}</b> — ${title}`);
      after();
      return req;
    },
    updateRequirement: (id, patch) => {
      set((s) => ({ requirements: s.requirements.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      after();
    },
    deleteRequirement: (id) => {
      set((s) => ({ requirements: s.requirements.filter((r) => r.id !== id) }));
      after();
    },

    // ── Risks ─────────────────────────────────────────────────────────────
    addRisk: (input) => {
      const risk: TmRisk = { ...input, id: uid("risk"), key: nextKey("risk", "RISK"), createdAt: now() };
      set((s) => ({ risks: [risk, ...s.risks] }));
      logActivity("risk", `Logged risk <b>${risk.key}</b> — ${risk.title}`);
      after();
      return risk;
    },
    updateRisk: (id, patch) => {
      set((s) => ({ risks: s.risks.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      after();
    },
    deleteRisk: (id) => {
      set((s) => ({ risks: s.risks.filter((r) => r.id !== id) }));
      after();
    },

    // ── Releases ──────────────────────────────────────────────────────────
    addRelease: (name, date) => {
      const rel: TmRelease = { id: uid("rel"), name, date: date ?? null, status: "planned", createdAt: now() };
      set((s) => ({ releases: [rel, ...s.releases] }));
      logActivity("release", `Created release <b>${name}</b>`);
      after();
      return rel;
    },
    updateRelease: (id, patch) => {
      set((s) => ({ releases: s.releases.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      after();
    },
    deleteRelease: (id) => {
      set((s) => ({ releases: s.releases.filter((r) => r.id !== id) }));
      after();
    },

    // ── Defects ───────────────────────────────────────────────────────────
    addDefect: (input) => {
      const defect: TmDefect = {
        id: uid("def"),
        key: nextKey("defect", "BUG"),
        title: input.title,
        description: input.description ?? "",
        severity: input.severity ?? "medium",
        status: input.status ?? "open",
        caseId: input.caseId ?? null,
        executionId: input.executionId ?? null,
        github: input.github ?? null,
        createdBy: actor(),
        createdAt: now(),
      };
      set((s) => ({ defects: [defect, ...s.defects] }));
      logActivity("defect", `Reported defect <b>${defect.key}</b> — ${defect.title}`);
      after();
      return defect;
    },
    updateDefect: (id, patch) => {
      set((s) => ({
        defects: s.defects.map((d) => {
          if (d.id !== id) return d;
          const next: TmDefect = { ...d, ...patch };
          // Auto-stamp resolvedAt on the resolved/closed transition (and clear it if
          // the defect is re-opened) so resolution-time metrics work with no extra UI.
          const isResolved = next.status === "resolved" || next.status === "closed";
          if (isResolved && !next.resolvedAt) next.resolvedAt = now();
          if (!isResolved) next.resolvedAt = null;
          return next;
        }),
      }));
      after();
    },
    deleteDefect: (id) => {
      set((s) => ({ defects: s.defects.filter((d) => d.id !== id) }));
      after();
    },

    // ── Performance / load runs ───────────────────────────────────────────
    startPerfRun: async (input) => {
      const id = uid("perf");
      const key = nextKey("perf", "PERF");
      const base: TmPerfRun = {
        id,
        label: input.label?.trim() || key,
        engine: "http-load",
        location: "local",
        vus: input.vus,
        durationSec: input.durationSec,
        status: "running",
        startedAt: now(),
        finishedAt: null,
        totalRequests: 0,
        errorRate: 0,
        avgMs: 0,
        p95Ms: 0,
        rps: 0,
        transactions: [],
        budgetP95Ms: input.budgetP95Ms ?? null,
        maxErrorRate: input.maxErrorRate ?? null,
        gateReason: null,
        createdBy: actor(),
      };
      set((s) => ({ perfRuns: [base, ...s.perfRuns] }));
      after();
      try {
        const r = await runPerf(input);
        const reasons: string[] = [];
        if (input.budgetP95Ms != null && r.p95Ms > input.budgetP95Ms)
          reasons.push(`p95 ${Math.round(r.p95Ms)}ms exceeds budget ${input.budgetP95Ms}ms`);
        if (input.maxErrorRate != null && r.errorRate > input.maxErrorRate)
          reasons.push(`error rate ${(r.errorRate * 100).toFixed(1)}% exceeds ${(input.maxErrorRate * 100).toFixed(1)}%`);
        const status: TmPerfRun["status"] = reasons.length ? "failed" : "passed";
        const done: TmPerfRun = {
          ...base,
          status,
          finishedAt: now(),
          totalRequests: r.totalRequests,
          errorRate: r.errorRate,
          avgMs: r.avgMs,
          p95Ms: r.p95Ms,
          rps: r.rps,
          durationSec: r.durationSec,
          transactions: r.transactions,
          gateReason: reasons.join("; ") || null,
        };
        set((s) => ({ perfRuns: s.perfRuns.map((x) => (x.id === id ? done : x)) }));
        logActivity(
          "run",
          `Perf run <b>${done.label}</b> — ${status} · p95 ${Math.round(done.p95Ms)}ms · ${(done.errorRate * 100).toFixed(1)}% err · ${Math.round(done.rps)} req/s`,
        );
        after();
        return done;
      } catch (e) {
        const errRun: TmPerfRun = { ...base, status: "error", finishedAt: now(), gateReason: String((e as Error)?.message ?? e) };
        set((s) => ({ perfRuns: s.perfRuns.map((x) => (x.id === id ? errRun : x)) }));
        after();
        return errRun;
      }
    },
    deletePerfRun: (id) => {
      set((s) => ({ perfRuns: s.perfRuns.filter((r) => r.id !== id) }));
      after();
    },
  };
});

// Kick off hydration from the shared server DB as soon as the store module loads
// (browser only). Fills the empty boot state; TM screens gate on `hydrated`.
if (typeof window !== "undefined") {
  void useTm.getState().hydrate();
}
