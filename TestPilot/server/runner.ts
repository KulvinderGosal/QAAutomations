// Server-side Playwright test runner.
// Runs inside the Vite dev server (Node) — spawns each framework's OWN
// Playwright binary in its own folder, so every suite runs exactly as it does
// from the terminal. Strictly additive: nothing here writes into the framework
// folders (JSON results go to os.tmpdir()).
//
// Notes (from the 2026-07 framework inventory):
// - Smoke/regression selection differs per framework (tag-grep vs directory) —
//   the presets below mirror each framework's own package.json scripts.
// - CLI --reporter REPLACES config reporters, which is intentional here: it
//   keeps TestPilot runs from writing the frameworks' sqlite results.db /
//   coverage sheets concurrently. Terminal runs keep full reporters.
// - ledgerport-saas "full" excludes @destructive on purpose (their test:safe).
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
// G3: deny-by-default network target guard shared with the frameworks (pure TS,
// no Node/Playwright imports). Ad-hoc runs must pass it before anything spawns.
import { checkTarget, assertAllowedTarget } from "../../packages/qa-core/guards/targets";
import { formatBlockedMessage, isBlockedError } from "../../packages/qa-core/errors";
// V1: verdict free text is persisted and posted to Slack — mask secret-shaped values.
import { redact } from "../../packages/qa-core/api/base";
// I1: session canary + run gate — probe the persona's saved login before a run.
import { describeIdentity, sessionGate, setPersonaRegistry, type PersonaDef, type SessionProbe } from "./sessions";
// V1 honest verdict floor: every finished run gets a 5-state verdict derived
// from its JSON report / stdout summary — a run that executed nothing is never a pass.
import { deriveVerdict, factsFromJsonReport, factsFromStdout, type ReportFacts, type Verdict } from "./qaLoop/verdict";
export type { Verdict, VerdictState, VerdictCounts } from "./qaLoop/verdict";

// Root that holds the per-product Playwright suites (this app's sibling folders).
// Portable: override with the QA_ROOT env var, else default to the parent of the
// directory the dev server runs from (…/TestPilot → repo root). Works on any
// clone without hardcoding a machine path.
export const QA_ROOT = process.env.QA_ROOT || path.resolve(process.cwd(), "..");

export type RunnerFramework = {
  id: string;
  label: string;
  brand: "PushEngage" | "LedgerPort";
  dir: string;
  /**
   * Test runner this framework uses. Default (undefined) = Playwright. "maestro" =
   * a mobile SDK harness driven by the Maestro CLI against its own npm scripts
   * (command mode only — no Playwright binary, no spec/smoke/full arg-building).
   */
  kind?: "playwright" | "maestro" | "ios-sim";
  /** Extra args for the Smoke preset — mirrors the framework's test:smoke. */
  smokeArgs: string[];
  /** Extra args for the Full-regression preset — mirrors test:regression (or the safe whole-suite). */
  fullArgs: string[];
  /** Playwright project names (empty = no picker; never pass --project). */
  projects: string[];
  /** Env var that switches target environment, with its allowed values. */
  envVar: string | null;
  envOptions: string[];
  defaultEnv: string | null;
  /** Optional map: env option label → actual env-var value (e.g. staging → a full BASE_URL). */
  envValueMap?: Record<string, string> | null;
  /** Optional GitHub repo (owner/repo) for a READ-ONLY "latest commit on master" display. */
  repo?: string | null;
  /**
   * For frameworks whose specs authenticate from a captured Playwright storage
   * state (`npm run auth:capture`): the session file(s) to watch, the command to
   * refresh them, and their expected lifetime. Drives the session-freshness panel
   * so a stale/missing login is flagged BEFORE it blocks a run.
   *
   * I1: `personas` are the `<framework>:<env>[:<name>]` sessions the canary probes
   * (via the framework's `npm run auth:probe`) and the run gate checks before a run
   * for that env starts. Omitted → one persona for `defaultEnv`. Per-persona
   * `files`/`cmd` override the framework-level ones.
   */
  auth?: {
    files: string[];
    cmd: string;
    ttlDays: number;
    personas?: { env: string; name?: string; files?: string[]; cmd?: string; selfHeal?: string }[];
    /**
     * I1: the env the framework itself picks when TestPilot passes no env var
     * (its config's own default). Omitted → `defaultEnv`. The run gate uses it so
     * an env-less run is checked against the persona it will really use.
     */
    unsetEnv?: string;
  } | null;
  notes: string;
};

export const FRAMEWORKS: RunnerFramework[] = [
  {
    id: "pushengage-site",
    label: "PushEngage Marketing Site",
    brand: "PushEngage",
    dir: path.join(QA_ROOT, "pushengage-site"),
    smokeArgs: ["--grep", "@smoke"],
    fullArgs: [],
    projects: ["chromium", "firefox", "webkit", "mobile-chrome", "mobile-safari"],
    envVar: "TEST_ENV",
    envOptions: ["production", "staging"],
    defaultEnv: "production",
    notes: "No auth needed. SUBMIT_FORMS=false by default so form tests never really submit.",
  },
  {
    id: "pushengage-app-dashboard",
    label: "PushEngage App Dashboard",
    brand: "PushEngage",
    dir: path.join(QA_ROOT, "pushengage-app-dashboard"),
    smokeArgs: ["--grep", "@smoke"],
    // Their test:regression greps @regression but no spec carries that tag yet —
    // the useful "full" is the whole suite.
    fullArgs: [],
    projects: ["chromium"],
    envVar: "APP_ENV",
    envOptions: ["staging", "production"],
    defaultEnv: "staging",
    auth: {
      files: ["test-results/.auth/app-dashboard-state.json"],
      // The sanctioned human capture (normal Chrome + CDP read-out); save-session.js
      // (auth:capture) is the older path.
      cmd: "npm run auth:capture:human",
      ttlDays: 7,
      personas: [{ env: "staging" }],
    },
    notes: "Needs a captured session (npm run auth:capture:human) for authenticated specs.",
  },
  {
    id: "pushengage-shopify-revamped",
    label: "PushEngage Shopify (Revamped)",
    brand: "PushEngage",
    dir: path.join(QA_ROOT, "pushengage-shopify-revamped"),
    smokeArgs: ["tests/smoke"],
    fullArgs: ["tests/regression"],
    projects: ["chromium", "firefox", "webkit", "ipad-portrait", "ipad-landscape", "mobile-iphone", "mobile-android"],
    envVar: "SHOPIFY_ENV",
    envOptions: ["staging", "production"],
    defaultEnv: "staging",
    // storageStatePathFor(env): .auth/state.<env>.json, falling back to the legacy .auth/state.json.
    auth: {
      files: [".auth/state.staging.json", ".auth/state.production.json", ".auth/state.json"],
      cmd: "SHOPIFY_ENV=staging npm run auth:capture",
      ttlDays: 7,
      personas: [
        { env: "staging", files: [".auth/state.staging.json", ".auth/state.json"], cmd: "SHOPIFY_ENV=staging npm run auth:capture" },
        { env: "production", files: [".auth/state.production.json", ".auth/state.json"], cmd: "SHOPIFY_ENV=production npm run auth:capture" },
      ],
    },
    notes: "SHOPIFY_ENV=staging|production picks the store/app (staging=pushengage-staging-qa/staging-pushengage, production=pushengage-production-qa/pushengage-1). Requires .auth/state.<env>.json or .auth/state.json (npm run auth:capture) — global-setup exits hard without it.",
  },
  {
    id: "pushengage-wp-plugin",
    label: "PushEngage WP Plugin",
    brand: "PushEngage",
    dir: path.join(QA_ROOT, "pushengage-wp-plugin"),
    smokeArgs: ["smoke"],
    fullArgs: ["regression"],
    projects: ["chromium", "firefox", "webkit"],
    envVar: "QA_ENV",
    envOptions: ["staging", "local", "production"],
    defaultEnv: "staging",
    // wp-admin storageState (wordpress_logged_in_* cookie, ~2-day lifetime). No unattended
    // re-login yet (I2a), so an expired cookie needs the headed save-wp-session.js.
    auth: {
      files: [".auth/wp-admin.json"],
      cmd: "QA_ENV=staging node scripts/save-wp-session.js",
      ttlDays: 2,
      personas: [{ env: "staging" }],
      // playwright.config.ts: QA_ENV ?? 'local' — an env-less run targets local, not staging.
      unsetEnv: "local",
    },
    notes: "Suite selection is by directory (e2e/smoke/a11y/visual/regression). 643 specs — full regression is long.",
  },
  {
    id: "ledgerport-saas-automation",
    label: "LedgerPort SaaS Dashboard",
    brand: "LedgerPort",
    dir: path.join(QA_ROOT, "ledgerport-saas-automation"),
    smokeArgs: ["--grep", "@smoke"],
    fullArgs: ["--grep-invert", "@destructive"],
    projects: [], // project names depend on LP_ENV (public-staging / authenticated-staging …)
    envVar: "LP_ENV",
    envOptions: ["staging", "production"],
    defaultEnv: "staging",
    auth: { files: [".auth/staging.json"], cmd: "npm run auth:capture", ttlDays: 7, personas: [{ env: "staging" }] },
    notes: "Serial suite (workers=1) sharing one account session — keep runs one-at-a-time. Full preset excludes @destructive.",
  },
  {
    id: "ledgerport-wp-plugin",
    label: "LedgerPort WP Plugin",
    brand: "LedgerPort",
    dir: path.join(QA_ROOT, "ledgerport-wp-plugin"),
    smokeArgs: ["tests/smoke/"],
    fullArgs: [
      "tests/01-dashboard/",
      "tests/02-connection/",
      "tests/03-mappings/",
      "tests/04-manual-sync/",
      "tests/05-audit-logs/",
      "tests/06-sync-config/",
      "tests/07-debug-logs/",
    ],
    projects: ["chromium"],
    envVar: "QA_ENV",
    envOptions: ["staging", "local"],
    defaultEnv: "staging",
    // authFileFor(env): .auth/<env>/admin.json, else .auth/admin.json. global-setup logs in
    // again from WP_ADMIN_USER / WP_ADMIN_PASS on local/staging hosts, so an expired
    // cookie heals itself on the next run (selfHeal) — only wrong-site/WAF block.
    auth: {
      files: [".auth/staging/admin.json", ".auth/admin.json"],
      cmd: "set WP_ADMIN_USER / WP_ADMIN_PASS in .env, then run any suite (global-setup logs in again)",
      ttlDays: 2,
      personas: [
        {
          env: "staging",
          selfHeal: "global-setup logs in again from WP_ADMIN_USER / WP_ADMIN_PASS in .env",
        },
      ],
    },
    notes: "Full preset mirrors its test:regression (7 area directories).",
  },
  {
    id: "ledgerport-shopify",
    label: "LedgerPort Shopify App",
    brand: "LedgerPort",
    dir: path.join(QA_ROOT, "ledgerport-shopify"),
    smokeArgs: ["tests/smoke"],
    // No test:regression script — the whole suite is the full regression.
    fullArgs: [],
    projects: ["chromium"],
    envVar: "SHOPIFY_ENV",
    // billingpagetesting-2 / silverlisting = utils/env.ts ENV_TARGETS entries pinned to one
    // staging-app QA store each (SHOPIFY_ENV=<store>, session .auth/<store>/state.json).
    envOptions: ["staging", "production", "billingpagetesting-2", "silverlisting"],
    defaultEnv: "staging",
    auth: {
      files: [".auth/staging/state.json", ".auth/state.json"],
      cmd: "SHOPIFY_ENV=staging npm run auth:capture",
      ttlDays: 7,
      personas: [
        { env: "staging" },
        { env: "billingpagetesting-2", files: [".auth/billingpagetesting-2/state.json", ".auth/state.json"], cmd: "SHOPIFY_ENV=billingpagetesting-2 npm run auth:capture" },
        { env: "silverlisting", files: [".auth/silverlisting/state.json", ".auth/state.json"], cmd: "SHOPIFY_ENV=silverlisting npm run auth:capture" },
      ],
    },
    notes:
      "Shopify → QuickBooks sync app (embedded iframe). SHOPIFY_ENV=staging|production picks the store/app (staging=ledgerport-staging-qa/staging-ledgerport, production=ledgerport/ledgerport). Requires .auth/<env>/state.json or .auth/state.json (SHOPIFY_ENV=<env> npm run auth:capture) — global-setup exits hard without it; specs also self-skip on the login wall / Cloudflare. Non-destructive: never disconnects QuickBooks or runs a destructive resync.",
  },
  {
    id: "ledgerport-marketing-site",
    label: "LedgerPort Marketing Site",
    brand: "LedgerPort",
    dir: path.join(QA_ROOT, "ledgerport-sites", "pushengage-ledgerport-site"),
    // Mirrors the site repo's package.json: test:smoke = tests/smoke/, test = whole suite.
    smokeArgs: ["tests/smoke/"],
    fullArgs: [],
    projects: ["Desktop Chrome", "Desktop Firefox", "Desktop Safari", "Mobile Chrome", "Mobile Safari"],
    // The site's playwright.config switches env via BASE_URL (a full URL), so map the
    // clean staging/production labels to the actual origins.
    envVar: "BASE_URL",
    envOptions: ["staging", "production"],
    envValueMap: { staging: "https://staging.ledgerport.com", production: "https://ledgerport.com" },
    defaultEnv: "staging",
    repo: "awesomemotive/pushengage-ledgerport-site",
    notes: "WordPress marketing site (staging.ledgerport.com / ledgerport.com). Pricing↔Plans-API parity + checkout specs. Read-only checkout — no account/payment; @manual-otp submit specs self-skip.",
  },
  {
    id: "pushengage-android-sdk",
    label: "PushEngage Android SDK",
    brand: "PushEngage",
    dir: path.join(QA_ROOT, "pushengage-android-sdk"),
    kind: "maestro",
    // Maestro is driven via npm scripts (command mode) — these Playwright fields
    // are unused for a maestro framework.
    smokeArgs: [],
    fullArgs: [],
    projects: [],
    envVar: null,
    envOptions: [],
    defaultEnv: null,
    repo: "awesomemotive/pushengage-android-sdk",
    notes:
      "Maestro UI tests against the SDK demo app (com.pushengage.PushNotificationDemo). Run via npm scripts / command mode (test:maestro, test:smoke, …). Needs JDK 17 + Android SDK + an emulator/device (Google-Play image for FCM) + the maestro CLI — none on the TestPilot host, so run on a device/CI machine.",
  },
  {
    // IAM (In-App Messaging, PR #34) on-device Maestro harness. Drives the demo app
    // via ~/QA-Automations/iam-android/automation/run.sh <flow>. Used by the TMS
    // "Run on device" action on the maestro-covered IAM cases (mode "maestro",
    // spec = a flow path under this dir). This host DOES have the toolchain
    // (JDK 17 + Android SDK + adb + emulator + maestro CLI), so runs execute here.
    id: "iam-android",
    label: "IAM Android (Maestro)",
    brand: "PushEngage",
    dir: path.join(QA_ROOT, "iam-android", "automation"),
    kind: "maestro",
    smokeArgs: [],
    fullArgs: [],
    projects: [],
    envVar: null,
    envOptions: [],
    defaultEnv: null,
    repo: "awesomemotive/pushengage-android-sdk-internal",
    notes:
      "IAM (In-App Messaging, PR #34) Maestro flows for the demo app. TMS 'Run on device' runs a single flow via run.sh; defaults to the staging fixture site (site_id 50510) which has published campaigns. Needs the local emulator booted.",
  },
  {
    // IAM iOS (In-App Messaging, iOS SDK PR #51 / task/in-app) on-Simulator harness.
    // Drives PushEngageExample via ~/QA-Automations/iam-ios/run-case.sh <event>
    // (build-if-needed + boot + launch with the QA fire-hook + dumpIAMState + screenshot).
    // Used by the TMS "Run on device" action on the ios-sim-tagged IAM iOS cases
    // (mode "ios", spec = a custom-event name, or empty for an app-open/auto launch).
    id: "iam-ios",
    label: "IAM iOS (Simulator)",
    brand: "PushEngage",
    dir: path.join(QA_ROOT, "iam-ios"),
    kind: "ios-sim",
    smokeArgs: [],
    fullArgs: [],
    projects: [],
    envVar: null,
    envOptions: [],
    defaultEnv: null,
    repo: "awesomemotive/pushengage-ios-sdk-internal",
    notes:
      "IAM iOS on the Simulator (task/in-app branch). TMS 'Run on device' runs run-case.sh <event> (fires an IAM event + dumps state + screenshots); defaults to staging site 3bd8264e. Needs full Xcode + an iOS Simulator runtime (present on this host).",
  },
];

/** I1: every persona of every auth-gated framework (`<framework>:<env>[:<name>]`). */
export function personaDefs(): PersonaDef[] {
  const out: PersonaDef[] = [];
  for (const fw of FRAMEWORKS) {
    if (!fw.auth) continue;
    const list = fw.auth.personas?.length ? fw.auth.personas : fw.defaultEnv ? [{ env: fw.defaultEnv }] : [];
    for (const p of list as NonNullable<NonNullable<RunnerFramework["auth"]>["personas"]>) {
      out.push({
        id: [fw.id, p.env, p.name].filter(Boolean).join(":"),
        framework: fw.id,
        frameworkLabel: fw.label,
        env: p.env,
        name: p.name,
        dir: fw.dir,
        files: p.files ?? fw.auth.files,
        captureCmd: p.cmd ?? fw.auth.cmd,
        ttlDays: fw.auth.ttlDays,
        selfHeal: p.selfHeal,
      });
    }
  }
  return out;
}
setPersonaRegistry(personaDefs);

function binPath(fw: RunnerFramework) {
  return path.join(fw.dir, "node_modules", ".bin", "playwright");
}

/** Captured-login freshness for an auth-gated framework (null = no login needed). */
export type SessionInfo = {
  required: true;
  exists: boolean;
  /** Session file path, relative to the framework dir (the freshest one found). */
  file: string;
  capturedAt: string | null; // ISO
  ageHours: number | null;
  ttlDays: number;
  status: "fresh" | "aging" | "stale" | "missing";
  captureCmd: string;
  /** Absolute framework dir, so the panel can show `cd <dir> && <cmd>`. */
  dir: string;
};

function sessionInfo(fw: RunnerFramework): SessionInfo | null {
  if (!fw.auth) return null;
  const { files, cmd, ttlDays } = fw.auth;
  // Use the freshest present file (a framework may write one of several).
  let bestMtime = 0;
  let bestRel: string | null = null;
  for (const rel of files) {
    const abs = path.join(fw.dir, rel);
    try {
      const m = statSync(abs).mtimeMs;
      if (m > bestMtime) {
        bestMtime = m;
        bestRel = rel;
      }
    } catch {
      /* file absent */
    }
  }
  if (!bestRel) {
    return {
      required: true,
      exists: false,
      file: files[0],
      capturedAt: null,
      ageHours: null,
      ttlDays,
      status: "missing",
      captureCmd: cmd,
      dir: fw.dir,
    };
  }
  const ageHours = (Date.now() - bestMtime) / 3_600_000;
  const ttlHours = ttlDays * 24;
  const status: SessionInfo["status"] =
    ageHours >= ttlHours ? "stale" : ageHours >= ttlHours * 0.7 ? "aging" : "fresh";
  return {
    required: true,
    exists: true,
    file: bestRel,
    capturedAt: new Date(bestMtime).toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
    ttlDays,
    status,
    captureCmd: cmd,
    dir: fw.dir,
  };
}

export type FrameworkHealth = RunnerFramework & {
  healthy: boolean;
  playwrightVersion: string | null;
  problem: string | null;
  session: SessionInfo | null;
  /** I1 persona ids for this framework (probe state: GET /api/sessions). */
  personas: string[];
};

export function frameworkHealth(): FrameworkHealth[] {
  return FRAMEWORKS.map((fw) => {
    let problem: string | null = null;
    if (!existsSync(fw.dir)) problem = "folder not found";
    else if (fw.kind === "maestro")
      problem =
        existsSync(path.join(fw.dir, ".maestro")) || existsSync(path.join(fw.dir, "flows"))
          ? null
          : "no maestro flows found";
    else if (fw.kind === "ios-sim")
      problem = existsSync(path.join(fw.dir, "run-case.sh")) ? null : "no run-case.sh harness found";
    else if (!existsSync(binPath(fw))) problem = "playwright not installed (run npm install in the folder)";
    let version: string | null = null;
    try {
      version = (
        JSON.parse(readFileSync(path.join(fw.dir, "node_modules", "@playwright", "test", "package.json"), "utf8")) as {
          version: string;
        }
      ).version;
    } catch {
      /* version stays null */
    }
    const personas = personaDefs().filter((p) => p.framework === fw.id).map((p) => p.id);
    return { ...fw, healthy: !problem, playwrightVersion: version, problem, session: sessionInfo(fw), personas };
  });
}

// ── Spec listing ─────────────────────────────────────────────────────────────

export type RunnerSpec = { file: string; line: number; title: string; tags: string[] };

const specCache = new Map<string, { at: number; specs: RunnerSpec[] }>();
const SPEC_CACHE_TTL = 5 * 60_000;

function fwById(id: string): RunnerFramework {
  const fw = FRAMEWORKS.find((f) => f.id === id);
  if (!fw) throw new RunnerError(404, `Unknown framework: ${id}`);
  return fw;
}

export class RunnerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "RunnerError";
  }
}

/** `playwright test --list --reporter=json`, flattened + de-duped across projects. */
export async function listSpecs(frameworkId: string, refresh = false): Promise<RunnerSpec[]> {
  const fw = fwById(frameworkId);
  if (fw.kind === "maestro" || fw.kind === "ios-sim") return []; // no Playwright specs (mobile harnesses)
  const cached = specCache.get(fw.id);
  if (!refresh && cached && Date.now() - cached.at < SPEC_CACHE_TTL) return cached.specs;
  if (!existsSync(binPath(fw))) throw new RunnerError(400, `Playwright is not installed in ${fw.dir}`);

  // JSON goes to a temp file (PLAYWRIGHT_JSON_OUTPUT_NAME): several configs
  // print dotenv banners to stdout before the reporter, so stdout isn't parseable.
  const listJsonPath = path.join(tmpdir(), `testpilot-list-${fw.id}-${Date.now()}.json`);
  const out = await new Promise<string>((resolve, reject) => {
    const errChunks: Buffer[] = [];
    const child = spawn(binPath(fw), ["test", "--list", "--reporter=json"], {
      cwd: fw.dir,
      env: { ...process.env, FORCE_COLOR: "0", PLAYWRIGHT_JSON_OUTPUT_NAME: listJsonPath },
    });
    // MUST drain stdout: --list still prints one line per test there, and an
    // unconsumed 64KB pipe blocks the child forever on big suites.
    child.stdout.resume();
    child.stderr.on("data", (d: Buffer) => errChunks.push(d));
    child.on("error", (e) => reject(new RunnerError(500, `Could not spawn playwright: ${e.message}`)));
    child.on("close", (code) => {
      void readFile(listJsonPath, "utf8").then(
        (raw) => {
          void rm(listJsonPath, { force: true }).catch(() => {});
          resolve(raw);
        },
        () =>
          reject(
            new RunnerError(
              500,
              `playwright --list failed (exit ${code}): ${Buffer.concat(errChunks).toString("utf8").slice(0, 400)}`,
            ),
          ),
      );
    });
    setTimeout(() => {
      child.kill("SIGKILL");
      reject(new RunnerError(504, "playwright --list timed out after 120s"));
    }, 120_000).unref();
  });

  type JsonSpec = { title: string; file: string; line: number; tags?: string[]; tests?: { tags?: string[] }[] };
  type JsonSuite = { file?: string; suites?: JsonSuite[]; specs?: JsonSpec[] };
  const root = JSON.parse(out) as { suites?: JsonSuite[] };

  const seen = new Map<string, RunnerSpec>();
  const walk = (suite: JsonSuite) => {
    for (const spec of suite.specs ?? []) {
      const key = `${spec.file}:${spec.line}:${spec.title}`;
      if (seen.has(key)) continue;
      const tagSet = new Set<string>([
        ...(spec.tags ?? []).map((t) => (t.startsWith("@") ? t : `@${t}`)),
        ...(spec.tests ?? []).flatMap((t) => (t.tags ?? []).map((x) => (x.startsWith("@") ? x : `@${x}`))),
        ...(spec.title.match(/@[\w:-]+/g) ?? []),
      ]);
      seen.set(key, { file: spec.file, line: spec.line, title: spec.title, tags: [...tagSet] });
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of root.suites ?? []) walk(s);

  const specs = [...seen.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  specCache.set(fw.id, { at: Date.now(), specs });
  return specs;
}

// ── npm scripts (for the Scheduler + "run any command" terminal) ───────────────

export type NpmScript = { name: string; command: string };

function readScripts(dir: string): Record<string, string> {
  try {
    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

/** All npm scripts declared in a framework's package.json (name + command). */
export function listScripts(frameworkId: string): NpmScript[] {
  const fw = fwById(frameworkId);
  const scripts = readScripts(fw.dir);
  return Object.entries(scripts).map(([name, command]) => ({ name, command }));
}

// ── Run management ───────────────────────────────────────────────────────────

export type RunMode = "spec" | "smoke" | "full" | "adhoc" | "command" | "maestro" | "ios";

/** Optional PR/task this run verifies — surfaced in the Reports run history. */
export type TaskRef = { taskId?: string; pr?: number; label?: string };

export type RunRequest = {
  framework: string;
  mode: RunMode;
  /** For mode "spec": relative file path, optionally with :line. */
  spec?: string;
  /** For mode "command": an npm script name from the framework's package.json. */
  script?: string;
  project?: string; // "" / undefined / "all" → no --project flag
  env?: string; // value for the framework's envVar
  /** Optional PR/task tag so the run is traceable in Reports. */
  taskRef?: TaskRef | null;
  /**
   * TMS single-case "Run": pin the run to the framework's FIRST project and
   * disable retries, for fast one-browser feedback. Without this, a spec run
   * with no --project executes the test once PER project (5–7 browsers, serial
   * on Shopify/LedgerPort) and retries per config — a "one case" click can take
   * minutes. Only affects mode "spec"; ignored elsewhere.
   */
  quick?: boolean;
  /** Run with a visible (headed) browser (adds `--headed`). TMS sets this for a
   *  small selection (≤10 runnable cases) so the user can watch; larger batches
   *  stay headless. `--headed` overrides the config's headless setting. */
  headed?: boolean;
  /**
   * I1 run gate. Default (undefined/true): a spec/smoke/full run — or a `test*`
   * npm script — of an auth-gated framework first probes the env's persona; a
   * human-needed session ends the run as BLOCKED{SESSION} before anything spawns.
   * `false` skips the check (explicit "run anyway").
   */
  sessionGate?: boolean;
};

const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";

/** Manual "test any URL" request. Credentials are used for this run only and
 *  are NEVER persisted, echoed in args/env output, or logged. */
export type AdhocRequest = {
  title?: string; // display label for the run
  url: string;
  project?: string; // chromium | firefox | webkit
  env?: string; // free-form label (production/staging/local/…) — recorded for display only
  loginUrl?: string;
  user?: string;
  pass?: string;
  expectText?: string;
  expectTitle?: string;
  // "api" runs adhoc/api.spec.ts (Playwright request, no browser) instead of the
  // page smoke — TestPilot's Manual Test "API request" mode.
  kind?: "smoke" | "api";
  method?: string; // GET | POST | PUT | PATCH | DELETE | HEAD
  headers?: string; // JSON object string; may carry secret auth headers (env-only)
  body?: string; // request body (non-GET/HEAD)
  expectStatus?: string; // expected HTTP status; blank = assert 2xx
  maxMs?: string; // latency SLA in ms; blank = none
  jsonPath?: string; // dot/index path to assert, e.g. data.plans.0.type
  jsonValue?: string; // expected value at jsonPath (string compare)
  contains?: string; // substring the response body must contain
};

export type RunFailure = { title: string; file: string; message: string };

export type RunSummary = {
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  durationMs: number;
  failures: RunFailure[];
};

export type Run = {
  id: string;
  framework: string;
  mode: RunMode;
  args: string[];
  env: Record<string, string>;
  /**
   * "blocked" (V1): the run finished but produced no trustworthy verdict —
   * 0 tests executed, an @case test skipped, the skip budget blown, or a qa-core
   * BlockedError. `verdict` says why and what a human must do. Never a pass.
   */
  status: "running" | "passed" | "failed" | "blocked" | "cancelled" | "error";
  cancelRequested: boolean;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  summary: RunSummary | null;
  /** V1 honest verdict — set when the run finishes (null/absent while running). */
  verdict?: Verdict | null;
  /** Ad-hoc runs only: a screenshot of the page as a data: URL. */
  screenshot: string | null;
  /** Optional PR/task this run verifies (for Reports traceability). */
  taskRef?: TaskRef | null;
  /** I1: the persona whose saved session the run gate checked (null/absent = not gated). */
  persona?: string | null;
};

/** How to derive this run's verdict (see qaLoop/verdict.ts). */
type VerdictCtx = {
  /** "exit-code" = Maestro / iOS run-case.sh / Maestro npm scripts (no Playwright counts). */
  harness: "playwright" | "exit-code";
  singleCase?: boolean;
  exitZeroAsserts?: boolean;
  /** The exact command a human runs to refresh this framework's saved login. */
  sessionAction?: string;
};

/** A BLOCKED{HARNESS} attempt is auto-retried once — unless it already ran this long. */
const RETRY_MAX_FIRST_ATTEMPT_MS = 20 * 60_000;

function verdictCtxFor(fw: RunnerFramework, mode: RunMode): VerdictCtx {
  if (mode === "maestro") return { harness: "exit-code", singleCase: true, exitZeroAsserts: true };
  if (mode === "ios") return { harness: "exit-code", singleCase: true };
  if (fw.kind === "maestro" || fw.kind === "ios-sim") return { harness: "exit-code" };
  return {
    harness: "playwright",
    sessionAction: fw.auth
      ? `cd ${fw.dir} && ${fw.auth.cmd} (the user runs it — it needs a real login), then re-run`
      : undefined,
  };
}

type RunInternal = Run & {
  child: ChildProcess | null;
  output: string;
  /** Chars dropped from the FRONT of `output` — offsets are absolute stream positions. */
  trimmed: number;
  jsonPath: string;
  killTimer: ReturnType<typeof setTimeout> | null;
  shotPath?: string | null;
  /** Where the story reporter writes its per-test trace (null for command mode). */
  storyPath: string | null;
  // ── V1 verdict / auto-retry bookkeeping (never exposed) ──
  verdictCtx?: VerdictCtx;
  /** Set by shutdownRunner: the runner itself killed the run (TestPilot restart). */
  interruptReason?: string;
  /** 1 = first attempt, 2 = the one automatic BLOCKED{HARNESS} retry. */
  attempt?: number;
  /** Absolute stream offset where the current attempt's output starts. */
  attemptStart?: number;
  attemptStartedAt?: number;
  /** performance.now() at attempt start — monotonic, does NOT advance while macOS sleeps. */
  attemptMonoStart?: number;
  firstAttempt?: Verdict["firstAttempt"];
  spawnError?: string | null;
  relaunch?: (() => void) | null;
  /** I1: true while the pre-run session probe is in flight (no child yet). */
  gating?: boolean;
};

const runs = new Map<string, RunInternal>();
let runSeq = 1;
let active: RunInternal | null = null;

const OUTPUT_CAP = 400_000; // chars kept per run

// ── Persistent run history (for the Reports page) ──────────────────────────────
// Every finished run is appended (newest-first) to a JSON file so the Reports
// page can show what was tested, when, with which PR/task — surviving restarts.
const HISTORY_FILE = path.join(process.cwd(), ".testpilot-runs.json");

export type RunHistoryEntry = {
  id: string;
  framework: string;
  mode: RunMode;
  label: string; // human-readable: the npm script / spec / mode
  status: Run["status"];
  summary: RunSummary | null;
  /** V1 verdict (absent on entries recorded before the verdict floor). */
  verdict?: Verdict | null;
  startedAt: string;
  finishedAt: string | null;
  taskRef: TaskRef | null;
};

function runLabel(r: RunInternal): string {
  if (r.mode === "command") return `npm run ${r.args[2] ?? ""}`.trim();
  if (r.mode === "maestro") return `maestro ${r.args[2] ?? ""}`.trim();
  if (r.mode === "ios") return `ios-sim run-case ${r.args[2] ?? "(launch)"}`.trim();
  if (r.mode === "spec") return r.args[1] ?? "spec";
  if (r.mode === "adhoc") return "ad-hoc URL test";
  return r.mode; // smoke | full
}

function recordHistory(r: RunInternal): void {
  try {
    let list: RunHistoryEntry[] = [];
    try {
      list = JSON.parse(readFileSync(HISTORY_FILE, "utf8")) as RunHistoryEntry[];
      if (!Array.isArray(list)) list = [];
    } catch {
      /* first write */
    }
    list.unshift({
      id: r.id,
      framework: r.framework,
      mode: r.mode,
      label: runLabel(r),
      status: r.status,
      summary: r.summary,
      verdict: r.verdict ?? null,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      taskRef: r.taskRef ?? null,
    });
    writeFileSync(HISTORY_FILE, JSON.stringify(list.slice(0, 200), null, 2));
  } catch {
    /* best-effort — history is non-critical */
  }
}

export function listRunHistory(): RunHistoryEntry[] {
  try {
    const list = JSON.parse(readFileSync(HISTORY_FILE, "utf8")) as RunHistoryEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// ── Per-run "story" detail (for the /runs/:id trace view) ──────────────────────
// The story reporter (reporters/story-reporter.cjs) writes a per-test trace to a
// temp file during the run; on finish we fold it (+ terminal tail + adhoc
// screenshot) into ONE durable detail file per run so the story survives the
// in-memory run cache and dev-server restarts. Detail files match the existing
// `.testpilot-*.json` watch-ignore glob, so writing them never reloads Vite.
const STORY_REPORTER = path.join(process.cwd(), "reporters", "story-reporter.cjs");
const DETAIL_PREFIX = ".testpilot-detail-";
const MAX_DETAIL_FILES = 60;
const MAX_INLINE_SHOTS = 8; // image attachments inlined as data URLs per run

function detailPath(id: string): string {
  return path.join(process.cwd(), `${DETAIL_PREFIX}${id}.json`);
}

/** One action in a test's timeline (test.step / pw:api / expect); hooks/fixtures dropped. */
export type StoryStep = { title: string; category: string; duration: number; depth: number; error: string | null };

/** One test's replay: its steps, printed narrative (stdout), error, and attachments. */
export type StoryTest = {
  title: string;
  file: string | null;
  line: number | null;
  project: string | null;
  status: string;
  expected: string;
  durationMs: number;
  retry: number;
  steps: StoryStep[];
  stdout: string[];
  stderr: string[];
  error: string | null;
  attachments: { name: string; contentType: string; dataUrl?: string }[];
};

/** Everything the /runs/:id story view needs, for one finished run. */
export type RunDetail = {
  id: string;
  framework: string;
  mode: RunMode;
  label: string;
  status: Run["status"];
  summary: RunSummary | null;
  verdict?: Verdict | null;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  env: Record<string, string>;
  args: string[];
  project: string | null;
  taskRef: TaskRef | null;
  /** Ad-hoc page screenshot (data URL), if any. */
  screenshot: string | null;
  /** Tail of the raw terminal output — the fallback story for command-mode runs. */
  outputTail: string;
  tests: StoryTest[];
};

type RawStoryTest = {
  title: string;
  titlePath?: string[];
  file?: string | null;
  line?: number | null;
  status?: string;
  expected?: string;
  duration?: number;
  retry?: number;
  steps?: StoryStep[];
  stdout?: string[];
  stderr?: string[];
  error?: string | null;
  attachments?: { name: string; contentType: string; path: string | null }[];
};

async function foldStoryTest(t: RawStoryTest, budget: { shots: number }): Promise<StoryTest> {
  const attachments: StoryTest["attachments"] = [];
  for (const a of t.attachments ?? []) {
    let dataUrl: string | undefined;
    if (a.path && (a.contentType || "").startsWith("image/") && budget.shots > 0) {
      try {
        if (statSync(a.path).size < 2_000_000) {
          const buf = await readFile(a.path);
          dataUrl = `data:${a.contentType};base64,${buf.toString("base64")}`;
          budget.shots--;
        }
      } catch {
        /* attachment gone / unreadable — list it without a preview */
      }
    }
    attachments.push({ name: a.name, contentType: a.contentType, dataUrl });
  }
  return {
    title: t.title,
    file: t.file ?? null,
    line: t.line ?? null,
    project: t.titlePath?.[1] ?? null,
    status: t.status ?? "unknown",
    expected: t.expected ?? "passed",
    durationMs: Math.round(t.duration ?? 0),
    retry: t.retry ?? 0,
    steps: t.steps ?? [],
    stdout: t.stdout ?? [],
    stderr: t.stderr ?? [],
    error: t.error ?? null,
    attachments,
  };
}

function pruneDetailFiles(): void {
  try {
    const dir = process.cwd();
    const files = readdirSync(dir).filter((f) => f.startsWith(DETAIL_PREFIX) && f.endsWith(".json"));
    if (files.length <= MAX_DETAIL_FILES) return;
    const byAge = files
      .map((f) => ({ f, m: statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    for (const { f } of byAge.slice(MAX_DETAIL_FILES)) rmSync(path.join(dir, f), { force: true });
  } catch {
    /* best-effort */
  }
}

/** Fold the story reporter's output + run metadata into one durable detail file. */
async function persistRunDetail(r: RunInternal): Promise<void> {
  try {
    let tests: StoryTest[] = [];
    if (r.storyPath) {
      const raw = await readFile(r.storyPath, "utf8").catch(() => null);
      if (raw) {
        const parsed = JSON.parse(raw) as { tests?: RawStoryTest[] };
        const budget = { shots: MAX_INLINE_SHOTS };
        tests = [];
        for (const t of parsed.tests ?? []) tests.push(await foldStoryTest(t, budget));
      }
    }
    const detail: RunDetail = {
      id: r.id,
      framework: r.framework,
      mode: r.mode,
      label: runLabel(r),
      status: r.status,
      summary: r.summary,
      verdict: r.verdict ?? null,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      exitCode: r.exitCode,
      env: r.env,
      args: r.args,
      project: (r.args.find((a) => a.startsWith("--project=")) ?? "").replace("--project=", "") || null,
      taskRef: r.taskRef ?? null,
      screenshot: r.screenshot ?? null,
      outputTail: r.output.slice(-20_000),
      tests,
    };
    writeFileSync(detailPath(r.id), JSON.stringify(detail));
    pruneDetailFiles();
  } catch {
    /* best-effort — the story view is non-critical */
  } finally {
    if (r.storyPath) await rm(r.storyPath, { force: true }).catch(() => {});
  }
}

export function getRunDetail(id: string): RunDetail {
  if (!/^[\w-]+$/.test(id)) throw new RunnerError(400, "invalid run id");
  try {
    return JSON.parse(readFileSync(detailPath(id), "utf8")) as RunDetail;
  } catch {
    throw new RunnerError(404, "No saved story for this run — it may be too old, or predate this feature.");
  }
}

function publicRun(r: RunInternal): Run {
  const {
    child: _child,
    output: _output,
    trimmed: _trimmed,
    jsonPath: _jsonPath,
    killTimer: _killTimer,
    shotPath: _shotPath,
    verdictCtx: _verdictCtx,
    attempt: _attempt,
    attemptStart: _attemptStart,
    attemptStartedAt: _attemptStartedAt,
    attemptMonoStart: _attemptMonoStart,
    interruptReason: _interruptReason,
    firstAttempt: _firstAttempt,
    spawnError: _spawnError,
    relaunch: _relaunch,
    gating: _gating,
    ...pub
  } = r;
  return pub;
}

export function getRun(id: string, offset: number): { run: Run; output: string; nextOffset: number } {
  const r = runs.get(id);
  if (!r) throw new RunnerError(404, "Run not found (the dev server may have restarted)");
  // Offsets are positions in the FULL stream ever emitted; `trimmed` chars have
  // been dropped from the front of the in-memory buffer.
  const streamLen = r.trimmed + r.output.length;
  const clamped = Math.min(Math.max(0, offset), streamLen);
  const gap = clamped < r.trimmed;
  const rel = Math.max(0, clamped - r.trimmed);
  const output = (gap ? "\n[runner] …older output trimmed…\n" : "") + r.output.slice(rel);
  return { run: publicRun(r), output, nextOffset: streamLen };
}

export function activeRunId(): string | null {
  return active?.id ?? null;
}

export function startRun(req: RunRequest): Run {
  const fw = fwById(req.framework);
  if (active) throw new RunnerError(409, `A run is already in progress (${active.id})`);
  // Maestro (mobile) frameworks have no Playwright binary and only run their own
  // npm scripts — so they're driven exclusively through command mode.
  if (fw.kind === "maestro") {
    if (req.mode !== "command" && req.mode !== "maestro")
      throw new RunnerError(
        400,
        `${fw.label} is a Maestro (mobile) framework — run a single flow (mode "maestro") or an npm script (command mode).`,
      );
  } else if (fw.kind === "ios-sim") {
    if (req.mode !== "ios" && req.mode !== "command")
      throw new RunnerError(
        400,
        `${fw.label} is an iOS-Simulator framework — run a single case (mode "ios").`,
      );
  } else if (req.mode === "maestro") {
    throw new RunnerError(400, `mode "maestro" is only for Maestro frameworks, not ${fw.label}.`);
  } else if (req.mode === "ios") {
    throw new RunnerError(400, `mode "ios" is only for the iOS-Simulator framework, not ${fw.label}.`);
  } else if (!existsSync(binPath(fw))) {
    throw new RunnerError(400, `Playwright is not installed in ${fw.dir}`);
  }

  // "command" mode runs a real npm script from the framework's package.json
  // (e.g. `npm run test:smoke`) exactly as it would from the terminal — the
  // Scheduler + the "run any command" terminal use this. The script must be one
  // the framework actually declares (no arbitrary shell).
  if (req.mode === "command") {
    const script = (req.script ?? "").trim();
    const scripts = readScripts(fw.dir);
    if (!script) throw new RunnerError(400, "mode 'command' needs an npm script name");
    if (!Object.prototype.hasOwnProperty.call(scripts, script))
      throw new RunnerError(400, `Unknown npm script '${script}' for ${fw.id} — pick one from its package.json`);

    const id = `run-${Date.now()}-${runSeq++}`;
    const jsonPath = path.join(tmpdir(), `testpilot-${id}.json`);
    const cmdArgs = ["run", script];
    const extraEnv: Record<string, string> = { PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath, FORCE_COLOR: "0" };
    // Many scripts already bake in their env (e.g. test:health:staging); but a
    // generic script (test:health) honours the framework's env var, so pass it
    // when the caller picked one. Scripts that set their own env win regardless.
    if (fw.envVar && req.env && fw.envOptions.includes(req.env))
      extraEnv[fw.envVar] = fw.envValueMap?.[req.env] ?? req.env;
    // Tag any report the run generates (test:smoke:report) with the PR/task.
    const refLabel = req.taskRef?.label || (req.taskRef?.pr ? `PR #${req.taskRef.pr}` : req.taskRef?.taskId || "");
    if (refLabel) extraEnv.SMOKE_TASK_REF = refLabel;
    const run: RunInternal = {
      id,
      framework: fw.id,
      mode: "command",
      args: ["npm", ...cmdArgs],
      env: fw.envVar && extraEnv[fw.envVar] ? { [fw.envVar]: extraEnv[fw.envVar] } : {},
      status: "running",
      cancelRequested: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      summary: null,
      screenshot: null,
      taskRef: req.taskRef ?? null,
      child: null,
      output: `$ npm run ${script}\n  # ${scripts[script]}\n  cwd ${fw.dir}\n\n`,
      trimmed: 0,
      jsonPath,
      killTimer: null,
      storyPath: null, // command mode uses the framework's own reporters — no story trace
      verdictCtx: verdictCtxFor(fw, "command"),
    };
    // The npm script keeps the framework's OWN reporters (never overridden). If
    // its config's json reporter honours PLAYWRIGHT_JSON_OUTPUT_NAME we parse that;
    // otherwise the V1 verdict reads Playwright's stdout summary ("N passed" …).
    // Either way the verdict floor applies (0 executed → BLOCKED, never passed).
    gateThenLaunch(run, personaForRun(fw, req), () => launch(run, NPM_BIN, fw.dir, cmdArgs, extraEnv));
    return publicRun(run);
  }

  // "maestro" mode runs ONE Maestro flow file on the local emulator/device via the
  // harness's run.sh (sources env.sh, boots/installs if needed, then `maestro test
  // <flow>`). spec = a flow path relative to the framework dir. Used by the TMS
  // "Run on device" action for the IAM cases. Pass/fail comes from the exit code.
  if (req.mode === "maestro") {
    const flow = (req.spec ?? "").trim();
    if (!flow) throw new RunnerError(400, 'mode "maestro" needs a flow path (spec)');
    // Relative path inside the framework dir only: a .yaml flow, no CLI flag / traversal.
    if (flow.startsWith("-") || flow.startsWith("/") || flow.includes("..") || !/\.ya?ml$/.test(flow))
      throw new RunnerError(400, `Invalid Maestro flow path '${flow}'`);
    if (!existsSync(path.join(fw.dir, flow))) throw new RunnerError(400, `Maestro flow not found: ${flow}`);
    if (!existsSync(path.join(fw.dir, "run.sh"))) throw new RunnerError(400, `No run.sh harness in ${fw.id}`);

    // Default to the staging fixture site that has published IAM campaigns (50510).
    // Callers may override with an explicit App ID (UUID) via env.
    const appId = req.env && /^[0-9a-f-]{36}$/i.test(req.env) ? req.env : "3ca8257d-1f40-41e0-88bc-ea28dc6495ef";
    const id = `run-${Date.now()}-${runSeq++}`;
    const extraEnv: Record<string, string> = { APP_ID: appId, FORCE_COLOR: "0" };
    const run: RunInternal = {
      id,
      framework: fw.id,
      mode: "maestro",
      args: ["bash", "run.sh", flow],
      env: { APP_ID: appId },
      status: "running",
      cancelRequested: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      summary: null,
      screenshot: null,
      taskRef: req.taskRef ?? null,
      child: null,
      output: `$ APP_ID=${appId} bash run.sh ${flow}\n  cwd ${fw.dir}\n\n`,
      trimmed: 0,
      jsonPath: path.join(tmpdir(), `testpilot-${id}.json`), // unused by maestro; verdict from exit code
      killTimer: null,
      storyPath: null,
      verdictCtx: verdictCtxFor(fw, "maestro"),
    };
    launch(run, "bash", fw.dir, ["run.sh", flow], extraEnv);
    // Safety net: a Maestro run drives an emulator (boot + flow). If the emulator
    // never boots or a flow wedges, auto-kill after a generous ceiling so it can't
    // hold the single run slot forever (run.sh itself also bounds its boot wait).
    // Cleared by the child close/error handlers on normal completion.
    run.killTimer = setTimeout(() => {
      if (runs.get(id)?.status === "running") {
        run.output += "\n[runner] maestro run exceeded 8m — killing to free the run slot\n";
        try {
          cancelRun(id);
        } catch {
          /* already gone */
        }
      }
    }, 8 * 60_000);
    run.killTimer.unref?.();
    return publicRun(run);
  }

  // "ios" mode runs ONE iOS IAM case on the Simulator via run-case.sh <event>
  // (build-if-needed + boot + launch the demo with the QA fire-hook + dumpIAMState +
  // screenshot). spec = a custom-event name, or empty for an app-open/auto launch.
  // Used by the TMS "Run on device" action for the ios-sim IAM cases. Pass/fail from exit code.
  if (req.mode === "ios") {
    const ev = (req.spec ?? "").trim();
    // event name only (letters/digits/_/-), or empty (= app-open launch). No flags/traversal.
    if (ev && !/^[\w-]{1,64}$/.test(ev)) throw new RunnerError(400, `Invalid iOS event name '${ev}'`);
    if (!existsSync(path.join(fw.dir, "run-case.sh"))) throw new RunnerError(400, `No run-case.sh harness in ${fw.id}`);
    const appId = req.env && /^[0-9a-f-]{36}$/i.test(req.env) ? req.env : "3bd8264e-154a-40fc-8ddc-0d9f94e39c53";
    const id = `run-${Date.now()}-${runSeq++}`;
    const extraEnv: Record<string, string> = { APP_ID: appId, FORCE_COLOR: "0" };
    const scriptArgs = ev ? ["run-case.sh", ev] : ["run-case.sh"];
    const run: RunInternal = {
      id,
      framework: fw.id,
      mode: "ios",
      args: ["bash", ...scriptArgs],
      env: { APP_ID: appId },
      status: "running",
      cancelRequested: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      summary: null,
      screenshot: null,
      taskRef: req.taskRef ?? null,
      child: null,
      output: `$ APP_ID=${appId} bash run-case.sh ${ev || "(launch)"}\n  cwd ${fw.dir}\n\n`,
      trimmed: 0,
      jsonPath: path.join(tmpdir(), `testpilot-${id}.json`),
      killTimer: null,
      storyPath: null,
      verdictCtx: verdictCtxFor(fw, "ios"),
    };
    // run-case.sh writes evidence/run-<tag>.png (tag = event, or "launch"); surface
    // it as the run screenshot so TMS "Run on device" can show the result image.
    const iosShot = path.join(fw.dir, "evidence", `run-${ev || "launch"}.png`);
    launch(run, "bash", fw.dir, scriptArgs, extraEnv, async () => {
      try {
        const buf = await readFile(iosShot);
        run.screenshot = `data:image/png;base64,${buf.toString("base64")}`;
      } catch {
        run.screenshot = null;
      }
    });
    // iOS build+boot can be slow; generous ceiling so a wedged sim can't hold the slot.
    run.killTimer = setTimeout(() => {
      if (runs.get(id)?.status === "running") {
        run.output += "\n[runner] iOS run exceeded 12m — killing to free the run slot\n";
        try {
          cancelRun(id);
        } catch {
          /* already gone */
        }
      }
    }, 12 * 60_000);
    run.killTimer.unref?.();
    return publicRun(run);
  }

  const args = ["test"];
  if (req.mode === "spec") {
    const spec = (req.spec ?? "").trim();
    if (!spec) throw new RunnerError(400, "mode 'spec' needs a spec path");
    // Guard: a relative path inside the framework only — and never anything
    // that Playwright would parse as a CLI flag (e.g. "--config=…").
    if (spec.startsWith("-") || spec.includes("..") || path.isAbsolute(spec))
      throw new RunnerError(400, "spec must be a relative path");
    if (!/^[\w@ ./()[\]-]+(:\d+)?$/.test(spec)) throw new RunnerError(400, "invalid spec path");
    args.push(spec);
  } else if (req.mode === "smoke") {
    args.push(...fw.smokeArgs);
  } else {
    args.push(...fw.fullArgs);
  }
  // Project selection. A "quick" single-case run pins to the framework's FIRST
  // project when the caller didn't name one, so `playwright test file:line`
  // doesn't fan out across every configured browser (5–7×, serial on
  // Shopify/LedgerPort). An explicit project (Test Runner dropdown) always wins;
  // "all" still means "run every project".
  let project = req.project;
  if ((!project || project === "all") && req.quick && req.mode === "spec" && fw.projects.length > 0) {
    project = fw.projects[0];
  }
  if (project && project !== "all" && fw.projects.includes(project)) {
    args.push(`--project=${project}`);
  }
  // Quick single-case runs skip retries for fast feedback (configs set 1–2).
  if (req.quick && req.mode === "spec") args.push("--retries=0");
  // Headed (visible browser) when requested — a small TMS selection (≤10) runs
  // headed so the user can watch; larger batches stay headless. `--headed`
  // overrides the config's headless setting.
  if (req.headed) args.push("--headed");
  // Add our story reporter alongside list+json so /runs/:id can replay the trace.
  const withStory = existsSync(STORY_REPORTER);
  args.push(withStory ? `--reporter=list,json,${STORY_REPORTER}` : "--reporter=list,json");

  const id = `run-${Date.now()}-${runSeq++}`;
  const jsonPath = path.join(tmpdir(), `testpilot-${id}.json`);
  const storyPath = withStory ? path.join(tmpdir(), `testpilot-story-${id}.json`) : null;
  const extraEnv: Record<string, string> = { PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath, FORCE_COLOR: "0" };
  if (storyPath) extraEnv.TESTPILOT_STORY_OUTPUT = storyPath;
  // Quick single-case runs (TMS "Run") carry no env → the framework would fall
  // back to its own default env file (often `local`, where no site exists, so
  // the spec skips or errors). Target the registry's defaultEnv (staging/prod)
  // so a one-click case run exercises a real environment. An explicit env wins.
  const envChoice = req.env || (req.quick ? (fw.defaultEnv ?? undefined) : undefined);
  if (fw.envVar && envChoice && fw.envOptions.includes(envChoice))
    extraEnv[fw.envVar] = fw.envValueMap?.[envChoice] ?? envChoice;

  const run: RunInternal = {
    id,
    framework: fw.id,
    mode: req.mode,
    args,
    env: fw.envVar && extraEnv[fw.envVar] ? { [fw.envVar]: extraEnv[fw.envVar] } : {},
    status: "running",
    cancelRequested: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    summary: null,
    screenshot: null,
    taskRef: req.taskRef ?? null,
    child: null,
    output: `$ playwright ${args.join(" ")}\n  cwd ${fw.dir}\n\n`,
    trimmed: 0,
    jsonPath,
    killTimer: null,
    storyPath,
    verdictCtx: verdictCtxFor(fw, req.mode),
  };

  gateThenLaunch(run, personaForRun(fw, req), () => launch(run, binPath(fw), fw.dir, args, extraEnv));
  return publicRun(run);
}

// ── I1 run gate: probe the persona's saved session before anything spawns ──────

/** npm scripts that are gated (test runs) vs. never gated (capture/probe/list/report…). */
const GATED_SCRIPT = /^test(:|$)/;
const UNGATED_SCRIPT = /probe|capture|login|list|install|typecheck|lint|report:open|show-report/i;
/** `test*` scripts that only drive public/anonymous pages (test:public, test:signup) — not session-gated. */
const NO_SESSION_SCRIPT = /(^|:)(public|signup)(:|$)/i;

/**
 * Which persona a run needs, or null (no gate): only Playwright spec/smoke/full runs
 * and `test*` npm scripts of an auth-gated framework, for an env that has a persona.
 * Env = the run's env, else the framework default (a script named `*:prod*` → production).
 */
export function personaForRun(fw: RunnerFramework, req: RunRequest): string | null {
  if (!fw.auth || req.sessionGate === false) return null;
  if (fw.kind === "maestro" || fw.kind === "ios-sim") return null;
  // The env the spawned process will REALLY use: the env var TestPilot passes
  // (command mode: req.env; spec/smoke/full: req.env, else defaultEnv for a `quick`
  // run — mirrors startRun), else the framework's own default (auth.unsetEnv).
  const choice = req.env || (req.mode !== "command" && req.quick ? fw.defaultEnv : null);
  const passed = choice && fw.envOptions.includes(choice) ? choice : null;
  let env: string | null = passed ?? fw.auth.unsetEnv ?? fw.defaultEnv;
  if (req.mode === "command") {
    const script = (req.script ?? "").trim();
    if (!GATED_SCRIPT.test(script) || UNGATED_SCRIPT.test(script) || NO_SESSION_SCRIPT.test(script)) return null;
    // An inline `<ENVVAR>=<value>` in the script body overrides the parent env.
    const body = readScripts(fw.dir)[script] ?? "";
    const baked = fw.envVar ? new RegExp(`(?:^|[\\s;&(])${fw.envVar}=([A-Za-z0-9._-]+)`).exec(body)?.[1] : undefined;
    if (baked) env = baked;
    else if (!req.env && /:prod(uction)?\b/i.test(script) && fw.envOptions.includes("production")) env = "production";
  } else if (req.mode === "spec") {
    // Public specs (signup, marketing pages) never use the saved session.
    if (/(^|\/)public\//.test((req.spec ?? "").trim())) return null;
  } else if (req.mode !== "smoke" && req.mode !== "full") {
    return null;
  }
  if (!env) return null;
  const id = `${fw.id}:${env}`;
  return personaDefs().some((p) => p.id === id) ? id : null;
}

const ZERO_COUNTS = { expected: 0, unexpected: 0, flaky: 0, skipped: 0, executed: 0 };

/** End a run that never spawned (session-blocked, or cancelled during the check). */
function finishWithoutStart(run: RunInternal, status: Run["status"], verdict: Verdict): void {
  run.gating = false;
  run.exitCode = null;
  run.finishedAt = new Date().toISOString();
  run.summary = null;
  run.verdict = redactVerdict(verdict);
  run.status = status;
  if (active?.id === run.id) active = null;
  recordHistory(run);
  void persistRunDetail(run);
  const ids = [...runs.keys()];
  while (ids.length > 20) runs.delete(ids.shift()!);
}

/** BLOCKED{SESSION}: ONE message naming the persona, the expected identity and the exact capture command. */
export function sessionBlockedVerdict(probe: SessionProbe): Verdict {
  const code = probe.code || probe.state;
  const expected = describeIdentity(probe.expected);
  const found = describeIdentity(probe.identity);
  const reason =
    `Saved session for persona ${probe.persona} is not usable (${code})` +
    (expected ? ` — expected ${expected}` : " — no expected identity on file (.auth/<env>/meta.json)") +
    (found ? `; saved session: ${found}` : "") +
    ". The run was not started.";
  const humanAction = `${probe.humanAction || probe.captureCmd} (in ${probe.dir}), then re-run`;
  return {
    state: "BLOCKED",
    cls: "SESSION",
    code,
    reason,
    humanAction,
    counts: { ...ZERO_COUNTS },
    source: "none",
    derivedAt: new Date().toISOString(),
  };
}

/** NOT_RUN: cancelled while the pre-run session check was still in flight. */
function finishCancelledBeforeStart(run: RunInternal): void {
  if (run.finishedAt !== null) return;
  finishWithoutStart(run, "cancelled", {
    state: "NOT_RUN",
    reason: "Cancelled before the run started (during the session check).",
    counts: { ...ZERO_COUNTS },
    source: "none",
    derivedAt: new Date().toISOString(),
  });
}

function gateThenLaunch(run: RunInternal, personaId: string | null, doLaunch: () => void): void {
  if (!personaId) {
    doLaunch();
    return;
  }
  run.persona = personaId;
  run.gating = true;
  runs.set(run.id, run);
  active = run; // hold the one-at-a-time slot while the probe runs
  run.output += `[runner] checking the saved session for persona ${personaId}…\n`;
  // cancelRun() ends a gating run at once (finishedAt set) — every callback below is then a no-op.
  const settled = () => run.finishedAt !== null;
  const cancelledBeforeStart = () => finishCancelledBeforeStart(run);
  const proceed = (line: string) => {
    if (settled()) return;
    if (run.cancelRequested) return cancelledBeforeStart();
    run.gating = false;
    run.output += line;
    try {
      doLaunch();
    } catch (e) {
      run.output += `[runner] could not start: ${(e as Error).message}\n`;
      finishWithoutStart(run, "error", deriveVerdict({ facts: null, exitCode: null, spawnError: (e as Error).message }));
    }
  };
  sessionGate(personaId).then(
    (g) => {
      if (settled()) return;
      if (run.cancelRequested) return cancelledBeforeStart();
      if (g.block) {
        const v = sessionBlockedVerdict(g.probe);
        run.output += `\n${formatBlockedMessage({ cls: "SESSION", code: v.code, reason: v.reason, humanAction: v.humanAction ?? "" })}\n`;
        return finishWithoutStart(run, "blocked", v);
      }
      const p = g.probe;
      proceed(`[runner] session ${p.state}${p.code ? `/${p.code}` : ""}${p.live ? " (live)" : ""}${g.note ? ` — ${g.note}` : ""}\n\n`);
    },
    (e) => proceed(`[runner] session check failed (${(e as Error).message}) — running anyway\n\n`),
  );
}

// Ad-hoc "test any URL" — runs TestPilot's own bundled Playwright against the
// generic adhoc/ project, parameterised by env. One-at-a-time like framework runs.
const TESTPILOT_ROOT = process.cwd(); // dev server is launched from the TestPilot dir
const ADHOC_DIR = path.join(TESTPILOT_ROOT, "adhoc");
const ADHOC_BIN = path.join(TESTPILOT_ROOT, "node_modules", ".bin", "playwright");
const ADHOC_PROJECTS = ["chromium", "firefox", "webkit"];

export function adhocHealth(): { ready: boolean; problem: string | null } {
  if (!existsSync(ADHOC_BIN))
    return { ready: false, problem: "Playwright isn't installed in TestPilot — run `npm install` in the TestPilot folder." };
  return { ready: true, problem: null };
}

// G3: route every ad-hoc target through packages/qa-core/guards/targets.ts.
//  • API mode: the request URL with its real method (production = GET/HEAD only,
//    and only to PRODUCTION_READ_ALLOWLIST paths).
//  • Page mode: the page URL (+ login URL) as GET — a browser navigation. If
//    credentials are supplied the smoke SUBMITS a login form, so the login target
//    is checked as POST (a production login is refused).
//  Unknown hosts are refused. A refusal is a 403 whose message is the qa-core
//  "[BLOCKED:TARGET/<code>] … -- human action: …" text (shown in the UI toast).
// A relative login URL ("/wp-login.php", e.g. from Ask AI) is resolved against the
// target URL, so the guard checks — and the smoke navigates — the same absolute URL.
function resolvedLoginUrl(req: AdhocRequest, url: string): string | undefined {
  const raw = req.loginUrl?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw, url).href;
  } catch {
    return raw; // unparseable → the guard refuses it as bad-url
  }
}

export function adhocTargetChecks(req: AdhocRequest, url: string): { url: string; method: string }[] {
  const checks: { url: string; method: string }[] = [];
  if (req.kind === "api") {
    checks.push({ url, method: (req.method || "GET").toUpperCase() });
    return checks;
  }
  checks.push({ url, method: "GET" });
  const loginUrl = resolvedLoginUrl(req, url);
  if (loginUrl) checks.push({ url: loginUrl, method: "GET" });
  if (req.user || req.pass) checks.push({ url: loginUrl || url, method: "POST" });
  return checks;
}

function assertAdhocTargets(req: AdhocRequest, url: string): void {
  for (const c of adhocTargetChecks(req, url)) {
    try {
      assertAllowedTarget(c.url, c.method);
    } catch (e) {
      if (isBlockedError(e)) {
        const d = checkTarget(c.url, c.method);
        const hint = d.code === "production-write" && req.kind !== "api" ? " (credentials make the page smoke submit a login form)" : "";
        throw new RunnerError(403, `Target refused by TestPilot's target guard${hint}: ${e.message}`);
      }
      throw new RunnerError(400, `Invalid target URL: ${(e as Error).message}`);
    }
  }
}

export function startAdhocRun(req: AdhocRequest): Run {
  if (active) throw new RunnerError(409, `A run is already in progress (${active.id})`);
  if (!existsSync(ADHOC_BIN))
    throw new RunnerError(400, "Playwright is not installed in TestPilot. Run `npm install` in the TestPilot folder.");
  const url = (req.url || "").trim();
  if (!/^https?:\/\//i.test(url)) throw new RunnerError(400, "Provide a full URL starting with http:// or https://");
  assertAdhocTargets(req, url);
  const project = req.project && ADHOC_PROJECTS.includes(req.project) ? req.project : "chromium";

  const id = `adhoc-${Date.now()}-${runSeq++}`;
  const jsonPath = path.join(tmpdir(), `testpilot-${id}.json`);
  const shotPath = path.join(tmpdir(), `testpilot-${id}.png`);
  const storyPath = existsSync(STORY_REPORTER) ? path.join(tmpdir(), `testpilot-story-${id}.json`) : null;
  const isApi = req.kind === "api";
  const method = (req.method || "GET").toUpperCase();
  const spec = isApi ? "api.spec.ts" : "smoke.spec.ts";
  const reporter = storyPath ? `list,json,${STORY_REPORTER}` : "list,json";
  const args = ["test", spec, "--config=adhoc.config.ts", `--project=${project}`, `--reporter=${reporter}`];

  // Secrets go in env ONLY (never in args / run.env / output).
  const extraEnv: Record<string, string> = {
    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath,
    FORCE_COLOR: "0",
  };
  if (storyPath) extraEnv.TESTPILOT_STORY_OUTPUT = storyPath;
  if (isApi) {
    extraEnv.ADHOC_API_URL = url;
    extraEnv.ADHOC_API_METHOD = method;
    if (req.headers?.trim()) extraEnv.ADHOC_API_HEADERS = req.headers.trim();
    if (req.body?.trim()) extraEnv.ADHOC_API_BODY = req.body;
    if (req.expectStatus?.trim()) extraEnv.ADHOC_API_EXPECT_STATUS = req.expectStatus.trim();
    if (req.maxMs?.trim()) extraEnv.ADHOC_API_MAX_MS = req.maxMs.trim();
    if (req.jsonPath?.trim()) extraEnv.ADHOC_API_JSONPATH = req.jsonPath.trim();
    if (req.jsonValue?.trim()) extraEnv.ADHOC_API_JSONVALUE = req.jsonValue.trim();
    if (req.contains?.trim()) extraEnv.ADHOC_API_CONTAINS = req.contains.trim();
  } else {
    extraEnv.ADHOC_URL = url;
    extraEnv.ADHOC_SCREENSHOT = shotPath;
    const loginUrl = resolvedLoginUrl(req, url);
    if (loginUrl) extraEnv.ADHOC_LOGIN_URL = loginUrl;
    if (req.user) extraEnv.ADHOC_USER = req.user;
    if (req.pass) extraEnv.ADHOC_PASS = req.pass;
    if (req.expectText?.trim()) extraEnv.ADHOC_EXPECT_TEXT = req.expectText.trim();
    if (req.expectTitle?.trim()) extraEnv.ADHOC_EXPECT_TITLE = req.expectTitle.trim();
  }

  const run: RunInternal = {
    id,
    framework: "adhoc",
    mode: "adhoc",
    args,
    // public, non-secret only (env label is display metadata; never a credential)
    env: isApi
      ? { url, method, ...(req.env?.trim() ? { env: req.env.trim() } : {}) }
      : { url, project, ...(req.env?.trim() ? { env: req.env.trim() } : {}) },
    status: "running",
    cancelRequested: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    summary: null,
    screenshot: null,
    child: null,
    output: isApi
      ? `$ ${req.title?.trim() ? `${req.title.trim()} — ` : ""}ad-hoc API → ${method} ${url}\n\n`
      : `$ ${req.title?.trim() ? `${req.title.trim()} — ` : ""}ad-hoc smoke → ${url}  [${project}]${req.user ? "  (best-effort login)" : ""}\n\n`,
    trimmed: 0,
    jsonPath,
    killTimer: null,
    shotPath,
    storyPath,
    verdictCtx: { harness: "playwright" },
  };

  launch(run, ADHOC_BIN, ADHOC_DIR, args, extraEnv, async () => {
    try {
      const buf = await readFile(shotPath);
      run.screenshot = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      run.screenshot = null;
    }
    await rm(shotPath, { force: true }).catch(() => {});
  });
  return publicRun(run);
}

// Shared spawn + stream + settle wiring for both framework and ad-hoc runs.
function launch(
  run: RunInternal,
  bin: string,
  cwd: string,
  args: string[],
  extraEnv: Record<string, string>,
  onClose?: () => Promise<void>,
) {
  // detached → its own process group, so cancel can take the browsers down too.
  const child = spawn(bin, args, { cwd, env: { ...process.env, ...extraEnv }, detached: true });
  run.child = child;
  run.attempt = run.attempt ?? 1;
  run.attemptStart = run.trimmed + run.output.length; // this attempt's output starts here
  run.attemptStartedAt = Date.now();
  run.attemptMonoStart = performance.now();
  run.relaunch = () => launch(run, bin, cwd, args, extraEnv, onClose);
  runs.set(run.id, run);
  active = run;

  const append = (d: Buffer) => {
    run.output += d.toString("utf8");
    if (run.output.length > OUTPUT_CAP) {
      const cut = run.output.length - OUTPUT_CAP;
      run.trimmed += cut; // keep absolute offsets valid for pollers
      run.output = run.output.slice(cut);
    }
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);

  child.on("error", (e) => {
    if (run.killTimer) clearTimeout(run.killTimer);
    run.status = "error";
    run.spawnError = e.message;
    run.verdict = deriveVerdict({ facts: null, exitCode: null, spawnError: e.message });
    run.output += `\n[runner] spawn error: ${e.message}\n`;
    run.finishedAt = new Date().toISOString();
    if (active?.id === run.id) active = null;
  });

  child.on("close", (code) => {
    void (async () => {
      if (run.killTimer) clearTimeout(run.killTimer);
      let summary: RunSummary | null = null;
      let report: unknown = null;
      try {
        ({ summary, report } = await parseResults(run.jsonPath));
      } catch {
        summary = null;
        report = null;
      }
      await rm(run.jsonPath, { force: true }).catch(() => {});

      // V1: derive the honest verdict for THIS attempt (JSON report → stdout
      // summary → exit code), before anything is published to pollers.
      const ctx: VerdictCtx = run.verdictCtx ?? { harness: "playwright" };
      const attemptOutput = run.output.slice(Math.max(0, (run.attemptStart ?? 0) - run.trimmed));
      let facts: ReportFacts | null = null;
      try {
        facts = report ? factsFromJsonReport(report) : ctx.harness === "exit-code" ? null : factsFromStdout(attemptOutput);
      } catch {
        facts = null;
      }
      if (!summary && facts) {
        summary = {
          expected: facts.counts.expected,
          unexpected: facts.counts.unexpected,
          flaky: facts.counts.flaky,
          skipped: facts.counts.skipped,
          durationMs: Date.now() - (run.attemptStartedAt ?? Date.now()),
          failures: [],
        };
      }
      const verdict = deriveVerdict({
        facts,
        exitCode: code,
        output: attemptOutput,
        cancelled: run.cancelRequested && code !== 0,
        interrupted: run.interruptReason ?? null,
        // Wall-clock minus monotonic elapsed = time the Mac spent asleep mid-run.
        hostSleptMs: hostSleptDuring(run.attemptStartedAt, run.attemptMonoStart),
        spawnError: run.status === "error" ? (run.spawnError ?? "spawn error") : null,
        harness: ctx.harness,
        singleCase: ctx.singleCase,
        exitZeroAsserts: ctx.exitZeroAsserts,
        // sessionAction is only set for frameworks with a saved login (fw.auth).
        hints: { sessionAction: ctx.sessionAction, hasSavedLogin: !!ctx.sessionAction },
      });

      // V1: a BLOCKED{HARNESS} attempt (browser/launch/infra hiccup) is retried
      // ONCE automatically before a human ever sees it — same run id, same slot,
      // so every poller (TM, Verify-fix, Pipelines, Scheduler) just keeps waiting.
      const attempt = run.attempt ?? 1;
      const firstAttemptMs = Date.now() - (run.attemptStartedAt ?? Date.now());
      if (
        verdict.state === "BLOCKED" &&
        verdict.cls === "HARNESS" &&
        // Deterministic harness blocks gain nothing from a retry.
        verdict.code !== "no-tests-found" &&
        attempt < 2 &&
        ctx.harness === "playwright" &&
        retrySafe(run, facts) &&
        !run.cancelRequested &&
        run.status !== "error" &&
        firstAttemptMs < RETRY_MAX_FIRST_ATTEMPT_MS &&
        run.relaunch
      ) {
        run.firstAttempt = { state: verdict.state, cls: verdict.cls, reason: verdict.reason };
        run.attempt = 2;
        run.output += `\n[runner] BLOCKED{HARNESS} on attempt 1 — ${verdict.reason}\n[runner] auto-retrying once…\n\n`;
        try {
          run.relaunch();
          return;
        } catch (e) {
          run.output += `[runner] retry could not start: ${(e as Error).message}\n`;
        }
      }
      if (attempt > 1) {
        verdict.attempts = attempt;
        verdict.firstAttempt = run.firstAttempt;
      }

      try {
        await onClose?.();
      } catch {
        /* screenshot read is best-effort */
      }
      // Assign summary + verdict + terminal status in the same synchronous
      // segment, status last — a poll must never see a final status without the
      // summary/verdict/screenshot it will ever get.
      run.exitCode = code;
      run.finishedAt = new Date().toISOString();
      run.summary = summary;
      run.verdict = redactVerdict(verdict);
      if (run.status !== "error") run.status = statusFromVerdict(verdict, code, run.cancelRequested);
      run.relaunch = null;
      if (active?.id === run.id) active = null;
      recordHistory(run); // persist for the Reports page (best-effort)
      await persistRunDetail(run); // persist the /runs/:id story trace (best-effort)
      const ids = [...runs.keys()];
      while (ids.length > 20) runs.delete(ids.shift()!);
    })();
  });
}

/**
 * V1 auto-retry must never re-execute something with side effects. Ad-hoc runs
 * (an API request may be a POST, a page run may submit a login) are never
 * retried. Command mode retries only a `test*` script (not probe/capture/login/…,
 * same filter as the I1 run gate) that demonstrably ran Playwright (a JSON report
 * or a stdout summary exists) — so `auth:spike-*`, `auth:capture`, `spike:*`,
 * `report`, `lint`… never run twice just because they print no test counts.
 */
function retrySafe(run: RunInternal, facts: ReportFacts | null): boolean {
  if (run.mode === "adhoc") return false;
  if (run.mode !== "command") return true;
  const script = run.args[2] ?? "";
  return GATED_SCRIPT.test(script) && !UNGATED_SCRIPT.test(script) && facts !== null;
}

/** Redact secret-shaped values from the verdict's free text (it is persisted and sent to Slack). */
function redactVerdict(v: Verdict): Verdict {
  const r = (s: string | undefined) => (s === undefined ? s : redact(s));
  return {
    ...v,
    reason: redact(v.reason),
    humanAction: r(v.humanAction),
    firstAttempt: v.firstAttempt ? { ...v.firstAttempt, reason: redact(v.firstAttempt.reason) } : v.firstAttempt,
  };
}

/** Map the V1 verdict onto the run's terminal status (BLOCKED is never "passed"). */
function statusFromVerdict(v: Verdict, code: number | null, cancelRequested: boolean): Run["status"] {
  if (cancelRequested && code !== 0) return "cancelled";
  if (v.state === "BLOCKED") return "blocked";
  if (v.state === "FAIL") return "failed";
  if (v.state === "NOT_RUN") return "cancelled";
  return code === 0 ? "passed" : "failed"; // PASS / PASS_WITH_GAPS
}

const KILL_ESCALATION_MS = 10_000;

export function cancelRun(id: string): Run {
  const r = runs.get(id);
  if (!r) throw new RunnerError(404, "Run not found");
  // I1: still in the pre-run session check — no child yet; the gate ends it as cancelled.
  if (r.status === "running" && r.gating && !r.cancelRequested) {
    r.cancelRequested = true;
    r.output += "\n[runner] cancel requested — the run had not started yet\n";
    finishCancelledBeforeStart(r); // frees the slot now; the in-flight probe result is ignored
    return publicRun(r);
  }
  // Don't flip status here — the run is still alive until 'close' fires (which
  // also delivers exitCode + summary to pollers). Just signal and escalate.
  if (r.status === "running" && !r.cancelRequested && r.child?.pid) {
    r.cancelRequested = true;
    r.output += "\n[runner] cancel requested — stopping Playwright…\n";
    const pid = r.child.pid;
    try {
      process.kill(-pid, "SIGTERM"); // whole process group
    } catch {
      r.child.kill("SIGTERM");
    }
    // Escalate: a wedged worker/browser that ignores SIGTERM would otherwise
    // hold `active` forever and 409 every future run.
    r.killTimer = setTimeout(() => {
      if (r.child && r.child.exitCode === null) {
        r.output += "[runner] still alive after 10s — sending SIGKILL\n";
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          r.child.kill("SIGKILL");
        }
      }
    }, KILL_ESCALATION_MS);
    r.killTimer.unref?.();
  }
  return publicRun(r);
}

/**
 * How long the host slept during [startMs, endMs]. Takes the larger of
 * (a) wall-clock minus monotonic drift and (b) the macOS power log's "Sleep … N secs"
 * entries — the authoritative source (2026-10-12: a 5-browser smoke ran 18.4 h with
 * the lid closed, asleep 16.8 h, and ~650 launch/navigation timeouts read as product
 * failures). pmset is only consulted for runs of 5+ minutes (the parse takes ~2 s).
 */
function hostSleptDuring(startMs: number | undefined, monoStart: number | undefined): number | null {
  if (startMs == null) return null;
  const endMs = Date.now();
  let slept = monoStart != null ? Math.max(0, endMs - startMs - (performance.now() - monoStart)) : 0;
  if (process.platform === "darwin" && endMs - startMs >= 5 * 60_000) {
    try {
      const log = execFileSync("pmset", ["-g", "log"], { encoding: "utf8", timeout: 15_000, maxBuffer: 256 * 1024 * 1024 });
      let fromLog = 0;
      for (const line of log.split("\n")) {
        const m = line.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d{4}) Sleep\s.*?(\d+) secs\s*$/);
        if (!m) continue;
        const t = Date.parse(m[1].replace(" ", "T").replace(/ ([+-]\d\d)(\d\d)$/, "$1:$2"));
        if (t >= startMs && t <= endMs) fromLog += Number(m[2]) * 1000;
      }
      slept = Math.max(slept, fromLog);
    } catch {
      /* pmset unavailable — keep the clock-drift estimate */
    }
  }
  return slept;
}

/** Kill any in-flight child when the dev server shuts down/restarts. */
export function shutdownRunner() {
  if (active) {
    // The close handler still fires (in this module instance) after the kill —
    // make it record an honest NOT_RUN instead of guessing a BLOCKED class from
    // the truncated output, and keep it from auto-retrying.
    active.cancelRequested = true;
    active.interruptReason =
      "Interrupted — TestPilot restarted while this run was in progress (a server/*.ts or vite.config.ts change reloads the dev server)";
  }
  if (active?.child?.pid) {
    try {
      process.kill(-active.child.pid, "SIGTERM");
    } catch {
      active.child.kill("SIGTERM");
    }
  }
  active = null;
}

// Register ONE process-exit hook per Node process, always pointing at the
// newest module instance. Vite restarts re-import this module; a plain
// process.on('exit', shutdownRunner) per restart would pile up listeners, each
// pinning its stale module's state.
type GlobalWithHook = typeof globalThis & { __testpilotRunnerShutdown?: () => void };
const g = globalThis as GlobalWithHook;
const firstLoad = !g.__testpilotRunnerShutdown;
g.__testpilotRunnerShutdown = shutdownRunner;
if (firstLoad) {
  process.on("exit", () => g.__testpilotRunnerShutdown?.());
}

/** Read the run's Playwright JSON report → the RunSummary + the raw report (for the V1 verdict). */
async function parseResults(jsonPath: string): Promise<{ summary: RunSummary | null; report: unknown }> {
  const raw = await readFile(jsonPath, "utf8").catch(() => null);
  if (!raw) return { summary: null, report: null };
  type JsonResult = { status?: string; error?: { message?: string } };
  type JsonTest = { status?: string; expectedStatus?: string; results?: JsonResult[] };
  type JsonSpec = { title: string; file: string; ok?: boolean; tests?: JsonTest[] };
  type JsonSuite = { suites?: JsonSuite[]; specs?: JsonSpec[] };
  const data = JSON.parse(raw) as {
    stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number; duration?: number };
    suites?: JsonSuite[];
  };
  const failures: RunFailure[] = [];
  const walk = (s: JsonSuite) => {
    for (const spec of s.specs ?? []) {
      if (spec.ok === false) {
        const firstErr = spec.tests?.flatMap((t) => t.results ?? []).find((r) => r.error?.message)?.error?.message;
        failures.push({
          title: spec.title,
          file: spec.file,
          message: (firstErr ?? "failed").split("\n")[0].slice(0, 300),
        });
      }
    }
    for (const x of s.suites ?? []) walk(x);
  };
  for (const s of data.suites ?? []) walk(s);
  return {
    summary: {
      expected: data.stats?.expected ?? 0,
      unexpected: data.stats?.unexpected ?? 0,
      flaky: data.stats?.flaky ?? 0,
      skipped: data.stats?.skipped ?? 0,
      durationMs: Math.round(data.stats?.duration ?? 0),
      failures: failures.slice(0, 50),
    },
    report: data,
  };
}
