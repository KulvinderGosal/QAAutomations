# TestPilot

TestPilot is an internal **Test Management platform** (a TestCollab-style TMS)
with a built-in **QA automation cockpit**. Its primary domain is Suites → Test
Cases, Test Plans → Test Runs, plus Requirements / Risks / Releases / Defects /
Traceability. On top of that it keeps the original automation layer — a QA queue
auto-synced from Asana/GitHub/Slack, a local Playwright runner, CI/CD pipelines,
scheduler and reports — so an "automated" test case runs on the real frameworks.
(Formerly the "Automation SaaS" / "checkpoint" prototype → "QA Automation
Cockpit"; rebuilt around the test-management model in the 2026-07 TMS pass.)

## Running

```bash
npm install
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

Prefer the preview tooling / `launch.json` config **testpilot-dev** to start the
dev server rather than raw `npm run dev` in a shell.

## Stack & conventions

- React 19 + TypeScript + Vite; Tailwind CSS v4; Zustand; TanStack Query; React Router; Radix UI; lucide-react.
- Path alias `@` → `./src` (see `vite.config.ts`).
- Match the existing code style — functional components, Tailwind utility classes, the UI primitives in `src/components/ui/`.

## Architecture notes

- **Test Management (primary surface, `src/tm/` + `src/screens/tm/`, 2026-07 TMS
  rebuild).** The sidebar leads with a **Test Management** group — **Dashboard
  (`/`) · Test Cases (`/tests`) · Test Plans (`/tests/plans`) · Test Runs
  (`/tests/runs`) · Requirements · Traceability · Releases · Defects ·
  Performance (`/tests/*`)** — and demotes the automation cockpit to an
  **Automation & Delivery** group (Overview moved to `/overview`). **2026-09 QA-process
  pass** (aligning TestPilot to the standard 7-phase QA lifecycle): **Traceability +
  Defects were UN-hidden** in the nav (they were hidden 2026-07-27 but are fully built
  + seeded), and a new **Performance** surface was added (see below). **Only Risks stays
  nav-hidden** now (route/screen/store/data still exist; commented in
  `src/components/layout/Sidebar.tsx` — un-comment + re-add the `AlertTriangle`
  import to restore). The Dashboard has an "Open defects" KPI tile plus a
  **Quality-metrics row** (test coverage %, requirement coverage %, defect density
  per 100 cases, escape rate = defects reaching GitHub, avg resolution time —
  `src/screens/tm/Dashboard.tsx` `qa` useMemo, `resolvedAt` auto-stamped by
  `updateDefect`). Cases carry an optional **`caseType`** (positive/negative/edge/
  boundary) + `requirementIds` for two-way traceability; Releases carry **entry/exit
  criteria + a GO/NO-GO gate** (`TmRelease.gateCriteria`/`signOff`, auto-readiness
  from linked-plan execution + open high/critical defects, plus a manual sign-off in
  `Releases.tsx`). **Requirements** has an **AI coverage-gap** action ("Analyze
  coverage" → `/api/qa/coverage` → `coverageGap()` in `server/qaPlanner.ts`, reusing
  the same 402 credit gate) that flags untested acceptance criteria + suggests the
  missing cases (`src/lib/qaPlanner.ts` `aiCoverageGap`). All TMS state lives in a
  dedicated Zustand store **`src/tm/store.ts` (`useTm`)**, seeded from the product
  catalog (one suite per product). **Persistence is a shared server-side SQLite DB**
  (2026-08): `server/tmStore.ts` (Node's built-in `node:sqlite`; DB at
  `~/QA-Automations/testpilot-tm.db`) behind the `tmApi()` middleware
  (`/api/tm/state|save|backups|restore`) in `vite.config.ts`; client `src/lib/tmStore.ts`.
  The store boots empty + `hydrate()`s from the server (auto-migrating a legacy
  `testpilot.tm` localStorage blob into a fresh DB on first load); the localStorage key
  is now only an offline **mirror/fallback**. Every write first snapshots the prior state
  (`tm_state_backup`, restorable via `/api/tm/backups`) so a bad write can't silently wipe
  the data. Needs **Node ≥ 22.5 + `--experimental-sqlite`** (wired into the `dev` script's
  `NODE_OPTIONS`); if the server/DB is unavailable the store degrades to localStorage-only.
  (The backend is still Vite dev-middleware — real *public* hosting needs the `HOSTING.md`
  Phase-2 backend extraction + auth.) **Mobile SDK suites (2026-07):** two extra suites — **PushEngage
  Android SDK** + **PushEngage iOS SDK** (`suite-pe-android-sdk`/`suite-pe-ios-sdk`)
  — are seeded from **`src/tm/mobileSdkSeed.ts`** (33 + 27 MANUAL cases derived from
  the real public SDK repos `awesomemotive/pushengage-android-sdk` +
  `pushengage-ios-sdk`; they run on devices/emulators, not the Playwright runner, so
  `automation:"manual"`/`frameworkId:null`). Wired into `seed()` (fresh installs) and
  a one-time idempotent `load()` backfill (`backfillMobile`, guarded by
  `seq.mobileSeed`) so they appear in already-persisted installs without re-adding
  user-deleted cases. Entities/enums/tones are in **`src/tm/types.ts`** (`TmSuite`,
  `TmCase` with steps[{step,expected}] + priority + automation + review +
  lastRunStatus + frameworkId, `TmPlan`, `TmExecution`, `TmRequirement`,
  `TmRisk` (likelihood×impact via `riskScore`/`riskBand`), `TmRelease`,
  `TmDefect`, plus `TM_*` label/tone maps + `TM_FRAMEWORKS`). `useTm` reads the
  main `useStore` lazily only to stamp the acting user and to drive the shared
  runner/RunPanel. **QA Copilot** ("Create with QA Copilot" on Test Cases)
  reuses `aiPlanTask`+`aiScenarios` from `src/lib/qaPlanner.ts` to generate cases
  (steps/expected/priority/area tags) into a suite as `review:"pending"` (same
  402 credit gate as other AI features). **Automated cases** bind to one of the 8
  frameworks; `runCase(id)` starts a real runner run (`startRunnerRun`, mode
  spec|smoke), attaches the shared RunPanel, self-polls `fetchRun`, and writes the
  verdict back to `case.lastRunStatus`/`runs`/`history`. **Suite management**
  (in the Test Cases tree): per-suite hover actions (add sub-suite, rename,
  **clone**, delete) + bulk **move cases between suites**. The case list has a
  **select-all header checkbox** (scoped to the visible/filtered cases,
  indeterminate on partial) and a **bulk "Run selected"** action: `runCases(ids)`
  filters the selection to runnable cases (`automation==="automated"` + a bound
  `frameworkId` + `specFile`) and runs them **sequentially** through the real
  runner (the runner is one-at-a-time, so it awaits each verdict before the next),
  reusing the single-case `runOneCase` core; a `runQueue{total,done}` transient
  slice drives the inline "Running x/N" + **Stop** (`stopBulkRun` = cooperative
  cancel + `cancelRunnerRun`) UI, verdicts write back per case, and a summary toast
  reports passed/failed/skipped. `cloneSuite(id,{targetParentId,withCases})` deep-copies a suite subtree
  (optionally its cases, run history reset) under any parent — the single-project
  analog of TestCollab's **Reusable Suites** (`/suites/link`). **Import from
  frameworks** (Test Cases toolbar → `importFrameworkSpecs`): pulls each
  framework's REAL Playwright specs via `fetchSpecs` (`playwright test --list`)
  and upserts them (stable id `imp-<fw>-<file>-<line>`, dedup) as **automated**
  cases into the product suite → per-test-folder sub-suite, each bound to
  `specFile:"file:line"` so **Run** executes that exact test via the runner
  (spec mode) and writes the verdict back. One click imported ~2360 real cases
  across all 8 frameworks. `src/screens/tm/`:
  `Dashboard` (KPI tiles + status/priority donuts + activity), `TestCases`
  (suite tree + CRUD/clone + list + detail modal + editor + Copilot — the flagship), and
  `TestPlans`/`TestRuns`/`Requirements`/`Risks`/`Releases`/`Defects`/
  `Traceability`/`Performance`. **zustand gotcha applies to `useTm` too** — select raw slices,
  derive in render.
- **Performance / load testing (`/tests/performance`, `src/screens/tm/Performance.tsx`,
  2026-09).** A MaxoPerf-style load surface: a **Run → Transactions → metrics** model
  (`TmPerfRun`/`TmPerfTxn` in types; `perfRuns` slice + `startPerfRun`/`deletePerfRun`
  in `store.ts`). Drive one or more target URLs at a set concurrency (VUs) for a
  duration; per-target **p50/p90/p95/p99 + throughput + error rate**, gated pass/fail
  on a **p95 latency budget + max error-rate SLA**. Backed by a real single-engine
  ("http-load") runner: `server/perf.ts` `runLoadTest()` (Node global `fetch`,
  hard-capped ≤50 VUs / ≤120s / ≤10 targets, per-request timeout) behind the
  `perfApi()` middleware (`POST /api/perf/run`, same-origin gated) in `vite.config.ts`;
  client `src/lib/perf.ts`. This is the LOCAL analog — the full **distributed
  multi-runner k6/JMeter fleet (MaxoPerf "runners" by engine/location) is deferred**
  (needs load-gen infra the dev host can't provide). Sends REAL requests — point it at
  staging, not production.
- The automation cockpit (below) keeps a single QA queue
  auto-synced from three connectors (Asana tasks, GitHub issues, Slack QA
  hand-offs). Automation/delivery screens are **Overview (`/overview`) · QA Queue ·
  Test Runner · Pipelines · Scheduler · Manual Test · QA Log · Fixtures · Reports · Task
  Detail · Integrations · Users & Team · Database**. The mock **Bugs** screen was removed
  in the 2026-07 CI/CD-refocus pass (real bugs live on GitHub + the Task Detail
  "Bugs for this PR" card); there is no dev-perspective,
  repo-coverage, or products/insights surface.
  ("Assigned to me" was folded into QA Queue as a scope toggle, and "Issues" was
  renamed "Bugs", in the 2026-07 merge pass — see the QA Queue / Bugs notes below.)
- **Overview** (`/overview`): gradient hero + KPI tiles + a "QA at a glance" row of
  hand-rolled SVG **donut charts** (`src/components/charts/Donut.tsx`) — queue by
  stage / source / ownership. Colors follow the dataviz skill's validated
  categorical palette (fixed order, never cycled).
- **QA Queue** (`/queue`, qa/admin/dev): the single work queue from all three
  connectors, filtered by **stage** (New → Ready → Verifying → Cleared) +
  **ownership** + a **Show: Anyone / Assigned to me** scope toggle (2026-07: the
  former `/assigned` screen folded in here). "Assigned to me" = items a **dev
  assigned to QA** — Asana + Slack qualify by connector design; GitHub only when
  issue `assignee`==you & `creator`!=you (needs `githubLogin` + `assignee`/
  `creator` on `GithubLink`). **Role-aware:** qa/admin get the full actionable
  queue (select/claim/Hand to AI/Run/verify, "Show" + "Ownership" filters); the
  **dev** role gets a read-only view locked to `scope="mine"` (no QA controls —
  just status + an open-at-source link), which is why `/queue` now grants `dev`.
  A **Group by dev** toggle (by assigning dev) is available in both modes.
- **GitHub Verify-fix workflow** (QA Queue, GitHub-origin rows): each GitHub
  issue row shows **Test issue** (runs the product smoke via the runner to
  reproduce/observe — NO GitHub writes) + **Verify fix**. The dev's latest
  non-viewer comment is synced from GitHub (`lastDevComment` in `server/github.ts`
  → `devComment {login,body,at}` on the normalized issue → `GithubLink.devComment`
  + `Task.devResponded` + a "💬 <dev> commented" activity entry + a "<dev>
  replied" indicator on the row). **Verify fix enables only once `devResponded` is
  set** (else disabled "Awaiting a dev fix"). Clicking it is **confirm-gated**
  (names the real repo/issue, warns it's a real write) → `verifyGithubFix` runs
  the product smoke (`defaultFrameworkFor(productId)`, mode `smoke`, tracked via
  module-level `pendingGithubVerify` keyed to the run id); the run-poll terminal
  branch calls `finishGithubVerify`: on a **pass** it posts a "✅ Verified &
  validated by QA" comment (`commentOnIssue` → `POST /api/github/comment` →
  `commentOnRepoIssue`) then closes the issue (`closeRepoIssue`), sets
  `task.fixVerification.state="closed"` + appends a `QaLogEntry` (with a `github`
  sub-record); on a **fail** it leaves the issue open and marks it failed. Both
  the comment and close are **REAL** GitHub writes needing a write-scoped token.
- **Task Detail — Bugs for this PR** (`taskDetail/BugsForPr.tsx`, GitHub tasks
  only): live GitHub view of the repo's issues scoped to the PR's feature
  label(s) (non-generic labels on the task, e.g. "shopify revamp"), with an "all
  repo issues" toggle. A donut **pie** (Open bugs / Addressed / Future
  improvements) + stat tiles, an open-issues list (GitHub **View** link + a
  **Close** button that performs a REAL GitHub close), and a collapsible
  closed list. Server: `listRepoIssues`/`closeIssue` in `server/github.ts` →
  `GET /api/github/repo-issues?repo=` + `POST /api/github/close-issue`; client
  `fetchRepoIssues`/`closeRepoIssue` in `src/lib/github.ts`. Close is real
  (needs a token with write scope) and confirm-gated.
- **Auth (client-side, no backend):** a login **gate** — `App.tsx` renders only
  `Login` until a session exists (`currentUserId`), then role-guards each route
  via `canAccess` (`lib/users.ts` `ROUTE_ROLES`). Roles: `admin` (all + Users &
  Team + Database), `qa` (full cockpit), `dev` (Overview · QA Queue [read-only,
  scoped to items assigned to them] · Bugs).
  `Login` (`src/screens/Login.tsx`) is a centered email + password card (logo,
  heading, "Forgot password?" local reset). **Passwords ARE checked** against a
  salted SHA-256 hash: `AppUser.passwordHash = "salt:sha256hex"` (Web Crypto over
  `salt:password`); `makePasswordHash`/`verifyPassword` in `lib/users.ts`. The
  admin seed (kgosal@awesomemotive.com) ships a hash computed OFFLINE (plaintext
  NEVER in source); `mergeSeedSecrets()` backfills it onto existing installs.
  Accounts with no hash accept any password (demo). This is "secure enough" for a
  browser-only tool — localStorage is inspectable, so it's NOT real security (a
  backend would be a separate build). Users/session persist to localStorage
  (`testpilot.users`, `testpilot.session`).
  **Users & Team** (`/users`, admin-only): own-profile edit + team CRUD + roles,
  with last-admin / self-removal guards in the store.
  **Database** (`/database`, admin-only): password-unlock gate (`verifyPassword`)
  → read-only tabbed tables over the app's local data (users/tasks/issues/saved
  tests/localStorage) + Export JSON. Passwords render as "set/not set", never the
  hash. Sidebar shows the signed-in user + sign-out; nav is role-filtered.
  **zustand gotcha:** never return a fresh array/object from a `useStore` selector
  (e.g. `s.users.filter(...)` / `s.users.find(...)`) — it trips React's getSnapshot
  infinite-loop warning; select the raw slice and derive in render.
- **Theming:** class-based dark mode (`.dark` on `<html>`, toggled from the
  Header sun/moon, persisted to `localStorage` `testpilot.theme`, default = OS).
  Accent is a **vivid indigo** (`--primary` ~oklch 0.52/0.70 hue 272–274);
  high-contrast ink + sharp cool borders (2026-07 "crystal clear" pass). Fonts:
  **Inter** body (with `cv11`/`ss01` stylistic sets) + **Sora** display on all
  `h1` (`--font-display`, global `h1` rule in `index.css`); both from Google
  Fonts in `index.html`. Colors are semantic CSS-var tokens in `src/index.css`
  (`--ink-1/2`, `--surface-1/2/3`, `--border`, `--card`, `--hero-1/2/3`,
  `*-surface`), light + dark values; components use token utilities (`text-ink-1`, `bg-surface-2`,
  `border-border`, …) NOT raw `oklch()` literals — the only intentional raw
  literals left are the RunPanel terminal (`oklch(0.15–0.18)` bg, `0.8/0.85`
  text), which stay dark in both modes. When adding UI, use tokens so dark mode
  keeps working.
- **Manual Test** (`/manual`): ad-hoc "test any URL" — a form (URL, env, browser,
  run-only creds, login URL, expect title/text) runs a generic headless smoke via
  `adhoc/smoke.spec.ts` (load, status, redirects, title, console errors, expect,
  screenshot; best-effort login if creds). Targets can be **saved** to
  localStorage (`testpilot.savedTests`) to rerun later — the password is NEVER
  saved (run-only). Run by TestPilot's OWN Playwright
  (`@playwright/test` devDep) against `adhoc/adhoc.config.ts` (chromium uses
  `channel:"chrome"` = system Chrome, no bundled-browser download). Credentials
  arrive via ADHOC_* env for that one process only — never in run.env/args/output,
  never persisted. Artifacts + JSON → os.tmpdir(). Shares the runner's run/poll/
  cancel infra + the extracted `src/screens/runner/RunPanel.tsx`. A **Page test |
  API request** mode toggle switches the form: **API request** mode runs
  `adhoc/api.spec.ts` (Playwright `request` fixture, no browser — from the
  Playwright API Playbook) with method/headers(JSON)/body/expect-status/max-ms
  (latency SLA)/json-path+value/body-contains assertions; the server branches on
  `AdhocRequest.kind==="api"` (ADHOC_API_* env). Headers carry any secret auth
  (env-only) — e.g. a browser User-Agent to clear Cloudflare on the LedgerPort
  Plans API.
  **Dev gotcha (fixed):** the runner/scheduler/pipeline persist `.testpilot-*.json`
  into the project root; Vite watches dotfiles, so every completed run triggered a
  full page reload that wiped the live RunPanel — `server.watch.ignored:
  ['**/.testpilot-*.json']` in `vite.config.ts` stops that.
- **Test Runner** (`/runner`): runs the eight local Playwright QA frameworks under
  `~/QA-Automations/` (pushengage-site, pushengage-app-dashboard,
  pushengage-shopify-revamped, pushengage-wp-plugin, ledgerport-saas-automation,
  ledgerport-wp-plugin, ledgerport-shopify, and ledgerport-marketing-site =
  `ledgerport-sites/pushengage-ledgerport-site`) — single spec / smoke /
  full-regression, Cypress-style. The **header brand tab scopes the card list**
  (PushEngage tab → PushEngage frameworks only, LedgerPort → LedgerPort, All →
  everything). `server/runner.ts` spawns each framework's OWN
  `node_modules/.bin/playwright` in its own folder (registry mirrors each
  framework's package.json presets; never "fix" the smoke/full args without
  checking those scripts). A framework may set `envValueMap` (env-option label →
  actual env-var value — the marketing site maps staging/production → a full
  `BASE_URL`) and `repo` (owner/repo → a **read-only** "latest commit on master"
  shown on its card via `GET /api/github/latest-commit` → `latestCommit()` in
  `server/github.ts`; never writes). JSON results go to os.tmpdir() — never write
  into the framework folders. One run at a time; `--reporter=list,json`
  intentionally bypasses their sqlite/coverage reporters. ALWAYS drain child
  stdout (a full 64KB pipe deadlocks big `--list` runs). **Mobile (Maestro)
  frameworks (2026-07):** a framework may set **`kind:"maestro"`** — a mobile SDK
  harness driven by the Maestro CLI, NOT Playwright. `pushengage-android-sdk`
  (`~/QA-Automations/pushengage-android-sdk`: the fetched SDK repo + its demo app
  `com.pushengage.PushNotificationDemo` + `.maestro/` flows + a package.json of
  `maestro test …` scripts) is the first. For `kind:"maestro"` the runner **skips
  the playwright-bin guard**, marks health from the `.maestro/` dir, returns no
  spec list, and allows **command mode only** (spec/smoke/full throw a clear 400) —
  so it's run via its npm scripts (`test:maestro`/`test:smoke`) from the Scheduler /
  Pipelines / command terminal, exactly like any other command-mode script. It needs
  JDK 17 + Android SDK + an emulator/device + the maestro CLI (none on the TestPilot
  host — runs on a device/CI machine). iOS (`pushengage-ios-sdk`, XCUITest) is a
  future analog; deferred (needs full Xcode + real-device push).
- **Scheduler** (`/schedule`, qa+admin): schedule automation per product +
  run any npm command in the shared terminal. Pick a framework → it lists ALL
  its `package.json` scripts (`GET /api/runner/scripts` → `listScripts` in
  `server/runner.ts`); a **`command`** run mode (added to the runner) does
  `npm run <script>` in the framework dir via the SAME one-at-a-time spawn/stream
  infra + RunPanel (so `test:smoke`, `test:health`, etc. run exactly as from the
  terminal, with their real reporters — unlike the Test Runner's `--reporter`
  override). A free-text input + per-script Run buttons cover "type and run".
  **Scheduling:** `server/scheduler.ts` persists jobs to
  `<TestPilot>/.testpilot-schedules.json` and a 30s ticker fires due ones through
  `startRun` (command mode) — cadence is interval / daily@HH:MM / weekly@day+HH:MM
  (local time). It's **dev-server-hosted** (fires only while `npm run dev` runs;
  survives restarts — no always-on backend, surfaced in the UI). Middleware
  `testpilot-schedule-api` (`/api/schedule/list|create|:id/run|:id/toggle|DELETE`);
  client `src/lib/schedule.ts`; screen `src/screens/Schedule.tsx`.
- **Pipelines** (`/pipelines`, qa+admin): the primary "run the tests" surface —
  a **CI/CD** view. Per product, an ordered pipeline (**Smoke → Regression →
  Report**, built from whichever of `test:smoke` / `test:regression` /
  `test:smoke:report` the framework declares — `stagesFor`) runs in **one
  click**, **sequentially, stop-on-fail**. `server/pipeline.ts` orchestrates it
  through the SAME one-at-a-time runner (each stage = a `command`-mode run) with
  a 3s watcher that advances on stage completion — server-side,
  so it survives client navigation (like the Scheduler). Middleware
  `testpilot-pipeline-api` (`/api/pipeline/list|stages|:id|:id/cancel` + POST to
  start); client `src/lib/pipelines.ts`; screen `src/screens/Pipelines.tsx`
  (per-product cards + a live stage tracker; the active stage streams in the
  shared `RunPanel` via the store's `attachRunnerRun`). Zero AI/connector
  dependency — it only uses the local runner, so it works without credits.
- **AI actions are credit-gated:** Hand-to-AI + auto-authoring call the
  Anthropic API; if the key is unfunded the call 402s. The store catches that
  and sets `aiUnfunded` (a credit/402/billing error), which **greys the
  "Hand to AI" button** with a "needs Anthropic credits" tooltip so it stops
  failing on click. `/api/ai/status` only checks a key EXISTS, not its balance.
- **Ask AI** (Manual Test): the `/manual` form has a **Title** field and an
  **Ask AI** prompt. Two actions: *Launch test* asks Claude to interpret the
  instruction into generic-smoke config (expect title/text, login URL) and runs
  the existing ad-hoc smoke — no code is generated or executed; *Generate spec*
  asks Claude to author a full Playwright spec shown for review, copyable and
  savable into a framework's `ai-generated/` folder (additive, never committed).
  Server: `server/aiTest.ts` (Anthropic SDK `@anthropic-ai/sdk`, model
  `claude-opus-4-8`, structured output for interpret) behind the
  `testpilot-ai-api` middleware (`/api/ai/status|interpret|generate|save`);
  client `src/lib/ai.ts`. **Credentials (any ONE):** an `ANTHROPIC_API_KEY` or
  `ANTHROPIC_AUTH_TOKEN` in `.env`, OR an `ant auth login` OAuth profile on disk
  — `client()` passes an explicit key/token, else builds a zero-arg
  `new Anthropic()` whose credential chain resolves the profile ("use existing
  Claude", no key to paste). An empty `ANTHROPIC_API_KEY=""` is treated as absent
  (never passed — it would auth blank and shadow the profile). **402/auth
  fallback:** all Claude calls go through `sendMessage()` — if an explicit
  .env key/token fails on a credit/auth error AND an `ant auth login` profile
  exists, it retries ONCE with the zero-arg client (the profile), so a stale or
  unfunded key in .env doesn't shadow a working profile. `/api/ai/status`
  reports `{ready, source}` (key/token/env/profile/none); the UI shows the source
  or "add a key … or run: ant auth login". The SDK is imported ONLY by the dev
  middleware — never by `src/`, so it never enters the bundle.
- **AI QA authoring** (`QaAuthoringCard` on Task Detail): Claude reads an
  assigned task (Asana/GitHub/Slack) and authors a full QA record in four chained
  stages — **Plan** (which areas to test: ui/unit/functional/cross-browser/
  responsive/a11y/perf/regression, each in/out-of-scope + priority + rationale;
  target environment; chosen framework; browsers/viewports/risks) → **Scenarios**
  (corner-case-focused: happy-path/negative/boundary/edge/error/security/a11y/
  responsive, each with steps + expected) → **Cases** (a real Playwright spec
  saved into the chosen framework's `ai-generated/` via the same `saveSpec`; the
  scenarios also populate `task.tests` so the existing Playwright card / Stepper /
  Run flow lights up) → **Excel** (an `exceljs` workbook — Test Plan / Test
  Scenarios / Test Cases / Coverage sheets — written to a durable
  `~/QA-Automations/testpilot-qa-records/` dir, downloadable via
  `GET /api/qa/record?path=`). Server: `server/qaPlanner.ts` (reuses aiTest.ts's
  `client`/`MODEL`/`saveSpec`; **`exceljs` is a server-only devDep** imported
  ONLY here, never by `src/`) behind the `testpilot-qa-api` middleware
  (`/api/qa/plan|scenarios|cases|export|record`); client `src/lib/qaPlanner.ts`
  (+ `PRODUCT_FRAMEWORK` productId→framework map). State lives on
  `task.qaAuthoring` (`QaAuthoring` in types) — in-memory, so the saved specs +
  xlsx are the durable record. **Triggers:** the per-task **Author QA plan**
  button, **Hand to AI** (`claimTask(id,"ai")` → `authorQaPlan`), and an
  **auto-author** pass on every new task sync (persisted `autoAuthor` toggle on
  Integrations, default on). Auto-authoring runs a **sequential** module queue
  (concurrency 1), authors each task id at most once per session
  (`autoAuthoredIds` — connector Refresh rebuilds task objects and drops the
  in-memory `qaAuthoring`, so this prevents re-authoring storms), and on a
  config/billing error **stops the burst** and surfaces it once (`silent` runs
  suppress per-task toasts; the queue summarises).
- **No secrets in the client.** Asana/GitHub/Slack/Anthropic tokens live in
  `.env` (gitignored) and are used **only server-side** by the Vite dev
  middleware in `vite.config.ts` (plugins `testpilot-asana-api`,
  `testpilot-github-api`, `testpilot-slack-api`, `testpilot-ai-api`). The
  browser calls `/api/asana/*`, `/api/github/*`, `/api/slack/*`, `/api/ai/*`;
  never expose a token to the bundle or prefix these vars with `VITE_`.
- **API hardening (G3, 2026-10).** All in `server/api.ts`, mounted first by
  `mountAll(mount, env, { ports })` so it fronts dev (Vite) and prod (`server/index.ts`)
  identically:
  - **Loopback only.** `vite.config.ts` sets `server.host: 'localhost'` (Vite's default,
    made explicit — on this Mac it binds IPv6 `::1`, so use `http://localhost:5173` or
    `http://[::1]:5173`, not `127.0.0.1`). Prod keeps `HOST=127.0.0.1` + the
    `TP_ALLOW_INSECURE` refusal. Never set `host: true`/`0.0.0.0`.
  - **Host allowlist** (`requestGuard`, DNS-rebinding defence): every request's `Host`
    must be `localhost` / `127.0.0.1` / `[::1]` on the configured port (dev
    `PORT||5173`, prod `PORT||5199`) or the port the socket actually accepted on; else
    **421** `host-not-allowed` (400 if Host is missing). Vite's own `allowedHosts`
    check also 403s unknown hostnames before ours in dev. `TP_ALLOWED_HOSTS=a:443,b:8080`
    adds exact extra `host:port`s (e.g. a private reverse-proxy name; a `:443`/`:80`
    entry also matches the bare name, since browsers omit default ports from Host). It
    is effectively prod-only: in dev, Vite's `allowedHosts` still 403s the name first.
  - **Origin required for writes.** `isSameOrigin` now REJECTS a non-GET/HEAD request
    with no `Origin` (it used to wave curl through), and `requestGuard` applies that to
    every non-GET `/api/*` (POST/DELETE/…) → 403 `origin-required` / `cross-origin`.
    Browsers always send Origin on these, so the UI is unaffected. **Local scripts that
    POST** (e.g. the testpilot-qa skill's `run-product.sh`) must add
    `-H "Origin: http://localhost:5173"`.
  - **Write nonce.** The four direct third-party write routes — `/api/asana/comment`,
    `/api/asana/complete-task`, `/api/github/close-issue`, `/api/github/comment` — also
    need `X-TP-Nonce`, issued by `GET /api/session/nonce` (`sessionHandler`; refused if
    Origin is foreign or `Sec-Fetch-Site` is cross-site). Nonces are in-memory (24h TTL,
    256 max), so a server restart invalidates them. Client `src/lib/session.ts`:
    `getSessionNonce()` caches one per page load; `fetchWithNonce()` sends it and, on a
    403 `bad-nonce`, refetches + retries ONCE (the server refused before writing). The
    write clients in `src/lib/asana.ts` / `src/lib/github.ts` use it; the existing
    confirm dialogs (Close task, Verify fix, BugsForPr Close) drive them unchanged.
  - **Ad-hoc target guard.** `startAdhocRun` (`server/runner.ts`) runs every target
    through `packages/qa-core/guards/targets.ts` `assertAllowedTarget` before spawning:
    API mode = the URL with its real method; page mode = URL (+ login URL) as GET, and
    if credentials are supplied the login target as POST (the smoke submits a login
    form). Local + allowlisted staging hosts = any method; production = GET/HEAD to
    `PRODUCTION_READ_ALLOWLIST` paths only; unknown hosts refused. A refusal is a **403**
    whose `error` is `Target refused by TestPilot's target guard: [BLOCKED:TARGET/<code>] …
    -- human action: …` (shown in the Manual Test toast; `parseBlockedMessage` reads
    it). Widening = a reviewed edit to the qa-core lists, never a flag.
  - Not guarded yet: redirects followed inside the ad-hoc browser/request run, and
    `/api/perf/run` targets (still "point it at staging").
- **V1 honest verdict floor (2026-10).** Every finished runner run gets a
  five-state **`run.verdict`** — `PASS | PASS_WITH_GAPS | FAIL | BLOCKED | NOT_RUN`,
  plus `cls` (qa-core `BLOCKED_CLASSES`), `reason`, `humanAction`, `code`, and
  `counts {expected, unexpected, flaky, skipped, executed}` — derived in
  `server/qaLoop/verdict.ts` (`deriveVerdict`, pure, no Node imports) from the
  run's Playwright JSON (`factsFromJsonReport`), else Playwright's stdout summary
  lines (`factsFromStdout`: "N passed/failed/skipped/flaky", "No tests found"),
  else the exit code (Maestro/iOS only). **The floor:** `executed == 0` → BLOCKED
  (cls SESSION if skip reasons / global-setup output mention login/session/auth,
  ENV for DNS/Cloudflare/network, FIXTURE/DEPLOY for "not provisioned"/"not
  deployed", else HARNESS) — **never PASS**; any skip of a test tagged
  `@case:<KEY>` → BLOCKED; skips (excluding `test.fixme`) > **20%** → BLOCKED; a
  qa-core BlockedError message (`[BLOCKED:<CLS>/<code>] … -- human action: …`) in a
  failure / global-setup output → BLOCKED{CLS} with its own humanAction (a marker
  only quoted in a neighbouring test's code frame is ignored); a real failing test →
  FAIL (wins over blocked siblings); a non-zero exit with no failing test (error
  outside any test) → BLOCKED{HARNESS}; passed with skips/flakes → PASS_WITH_GAPS;
  cancelled → NOT_RUN. `Run.status` gains **`"blocked"`** (a BLOCKED verdict is
  never `"passed"`, so Pipelines stop, Scheduler alerts say BLOCKED, Reports show it).
  **Infrastructure ≠ product (2026-10-13 fixes):**
  - Failures whose error is a browser launch or crash (`browserType.launch`, "Executable doesn't exist", "browser has been closed") are never counted as product failures. They're tallied as `verdict.infraFailures`, and if nothing real failed the result is BLOCKED{HARNESS/browser-launch}.
  - Navigation/network errors and plain test timeouts count as infrastructure **only when the host slept during the run**. That covers net::ERR_*, NS_ERROR_*, WebKit's "Internet connection appears to be offline" and `Test timeout of Nms`. Otherwise a page that won't load is an outage and stays a FAIL.
  - Sleep (`verdict.hostSleptMs`, `runner.ts` `hostSleptDuring`) is the larger of wall-clock vs `performance.now()` drift and the macOS power log's `pmset -g log` "Sleep … N secs" entries. The power log is read only for runs of 5+ min, because the parse takes about 2 s.
  - A slept run with real failures stays FAIL, but its reason lists the excluded count and the sleep, and its humanAction says results after the sleep are unreliable and to keep the Mac awake (`caffeinate -dimsu`).
  - Origin of these fixes: a 5-browser LedgerPort marketing smoke ran 18.4 h, asleep 16.8 h with the lid closed. It reported "689 failed"; the honest verdict is 5 real failures (4 pricing-card ↔ Plans API, 1 sitemap) with 688 infrastructure failures excluded.
  - A run killed by `shutdownRunner` (a Vite in-process restart on any `server/*.ts` edit) is NOT_RUN "interrupted — re-run". It is never a guessed class.
  - Keyword SESSION is suppressed for frameworks with no saved login (`hints.hasSavedLogin`). Explicit BlockedError markers still win.
  **Command mode still never overrides the framework's reporters** — the verdict
  just reads their JSON (if their json reporter honours `PLAYWRIGHT_JSON_OUTPUT_NAME`)
  or their stdout summary. **Auto-retry:** a BLOCKED{HARNESS} attempt is relaunched
  ONCE in place (same run id/slot, pollers keep waiting; `[runner] auto-retrying once…`
  in the output; `verdict.attempts=2` + `firstAttempt`), except deterministic
  `no-tests-found`, spawn errors, Maestro/iOS, cancelled runs, a first attempt
  that took ≥20 min, **ad-hoc runs** (an API request may be a POST), and command-mode
  scripts that are not `test*` (or match probe/capture/login/…, the I1 gate filter) or
  left no Playwright evidence (`retrySafe`) — so `auth:spike-*`, `auth:capture`,
  `report`… never run twice. Verdict free text (`reason`/`humanAction`) is passed
  through qa-core `redact()` before it is stored or posted to Slack. The verdict is persisted on the run record, the
  `.testpilot-runs.json` history and the `/runs/:id` detail, and exposed by the
  existing `GET /api/runner/runs/:id`, `/api/reports/history`, `/api/runner/detail`.
  **TM:** `runOneCase` (runCase/runCases) writes `lastRunStatus` from the verdict
  (BLOCKED → `blocked`, PASS_WITH_GAPS → `passed`, FAIL → `failed`, NOT_RUN →
  `skipped`) with a history note — Test Cases shows **"Blocked by <cls>: <humanAction>"**
  (or "Passed with gaps: …") under the case title and in the case modal; RunPanel shows
  the same line + reason. **GitHub Verify-fix** (`finishGithubVerify`) comments/closes
  **only** when `verdict.state==="PASS"` with `executed>0` (`isHonestPass` in
  `src/lib/runner.ts`); anything else is **inconclusive** (`fixVerification.state=
  "blocked"`, note shown on the QA Queue row, task back to `ready`, NO GitHub write).
  Unit tests: `npm run test:verdict` (node:test via tsx; crafted JSON fixtures in
  `server/qaLoop/fixtures/`).
- **I1 session canary + run gate (2026-10).** A **persona** is
  `<framework>:<env>[:<name>]` (`packages/qa-core/probe/contract.md`). Each auth-gated
  framework in `FRAMEWORKS` declares `auth.personas` (default: one for `defaultEnv`);
  `personaDefs()` in `server/runner.ts` registers them with `server/sessions.ts`
  (`setPersonaRegistry` — sessions.ts never imports runner.ts). Current personas:
  app-dashboard `:staging` (capture = `npm run auth:capture:human`), shopify-revamped
  `:staging` + `:production` (`.auth/state.<env>.json`, falling back to `.auth/state.json`),
  pushengage-wp-plugin `:staging` (`.auth/wp-admin.json`), ledgerport-saas `:staging`,
  ledgerport-wp-plugin `:staging` (`.auth/<env>/admin.json` → `.auth/admin.json`;
  **selfHeal** — its global-setup logs in again from WP_ADMIN_USER/PASS, so expired =
  warn, not block), ledgerport-shopify `:staging` + `:billingpagetesting-2` +
  `:silverlisting` (pinned `ENV_TARGETS` in `ledgerport-shopify/utils/env.ts`; also
  added to its `envOptions`).
  - **`probeSession(persona, {force?, live?})`**: if the framework's package.json has an
    `auth:probe` script it spawns `npm run --silent auth:probe -- --persona <id> [--live]`
    in the framework dir (both pipes drained, 60s timeout, a harness-error retried once)
    and parses the LAST stdout line that is a probe result (exit 0 ok / 10 refreshable /
    20 human-needed / 30 harness-error); else a fallback reads the storageState mtime +
    JWT `exp` (state `unknown-probe-missing`). Every string is passed through qa-core
    `redact()`; only identity labels + expiry times are kept — **never a token**.
    Cached **10 min** per persona, concurrent callers share one probe. `--live` (ONE
    read-only GET through the qa-core clients) is **refused for production personas**.
  - **Severity** (`severityOf`): `ok`; `warn` = refreshable, harness-error, probe
    missing, a selfHeal persona's expired/logged-out, or a cookie session only `--live`
    can confirm (`stale-session-cookie` / `unverified-session-cookie`); `block` = every
    other human-needed (expired, no-file, no-tokens, wrong-account, logged-out, waf…).
  - **Run gate** (`gateThenLaunch` in runner.ts): spec/smoke/full runs and `test*` npm
    scripts (not `*probe*`/`*capture*`/`*list*`…) of an auth-gated framework, for an env
    that has a persona (`personaForRun`; env = the env the child will REALLY use: an inline
    `<ENVVAR>=<value>` in the npm script body wins, else the env TestPilot passes (req.env,
    or `defaultEnv` for a `quick` run), else the framework's own default `auth.unsetEnv`
    (pushengage-wp-plugin = `local`) → `defaultEnv`; `test:public`/`test:signup` scripts and
    `public/` specs are never gated), probe first while holding the one run slot. **block
    → the run never spawns**: status `blocked`, verdict `BLOCKED{SESSION}` whose ONE
    message names the persona, the expected identity (meta.json) + the saved one, and
    the exact capture command (`sessionBlockedVerdict`, also printed as the qa-core
    `[BLOCKED:SESSION/<code>] … -- human action: …` line). A soft cookie code on a
    non-production persona is first confirmed with one `--live` probe; still soft →
    runs (noted). Cancel during the check → `cancelled`/NOT_RUN at once (slot freed; the
    in-flight probe result is ignored). `RunRequest.sessionGate:
    false` skips the gate. `Run.persona` names the checked persona. TM/Verify-fix/
    Pipelines/Scheduler see it through the existing V1 `blocked` handling.
  - **Canary** (`server/scheduler.ts`, built-in, not a user schedule): `startScheduler()`
    arms it — once **2 min after start-up**, then **every 6h** — probing every persona
    offline (`probeAll`, concurrency 2). Only a **severity change** (first sighting counts
    only if it is `block`) is announced: ONE batched macOS notification
    (`osascript`, text passed as argv) + the UI. No Slack. The listener is global, so
    changes the run gate / a manual re-probe discover are announced the same way.
    When a persona stops blocking: Scheduler jobs that were session-blocked on it
    (`Schedule.blockedOn`) **re-queue** (fire on the next tick), and its one Slack
    completion alert is re-armed (a scheduled run blocked on an already-alerted persona
    posts nothing). State + last 50 changes persist to `.testpilot-sessions.json`
    (gitignored, Vite-watch-ignored). launchd/StartCalendarInterval (spec step 5) is NOT
    done.
  - **API** (`sessionsHandler` in server/api.ts): `GET /api/sessions[?cached=1]` → `{sessions:
    [{persona, framework, env, dir, files, captureCmd, probe, probeAgeSec}], blocking,
    warnings, events, canary}` (stale entries re-probed offline first unless `cached=1`);
    `POST /api/sessions/:persona/probe` `{live?}` — same-origin + `X-TP-Nonce`.
    `/api/runner/frameworks` adds `personas: string[]` per framework.
  - **UI**: Test Runner → **Test sessions** panel (`src/screens/TestRunner.tsx`) — a red
    banner when any persona blocks, one row per persona (severity, state/code, expiry,
    saved vs expected identity, human action, Re-probe, Verify live for confirmable
    non-production cookie sessions, Copy capture cmd), framework-card chip from the
    default persona. Header **SessionBadge** (`src/components/layout/SessionBadge.tsx`):
    red "N sessions" pill (cached state, 60s poll, refreshed on the
    `testpilot:sessions-changed` window event) → `/runner`. Client `src/lib/sessions.ts`.
- **V2a Asana intake by gid + `@case` mapping (2026-10).** Turns an Asana QA task
  into TM cases WITHOUT acting on anything it says.
  - **Read-only Asana client** (`server/asana.ts`): `getTaskFull(gid)` (opt_fields notes,
    html_notes, custom_fields, memberships, parent, permalink_url, completed, …),
    `listSubtasks` / `listStories` / `listAttachments` (all follow `next_page.offset`,
    cap 50 pages; attachments = names/hosts only, never downloaded, no signed URLs,
    each mapped to the comment closest in time ≤10 min). Routes `GET /api/asana/task/:gid`
    + `GET /api/asana/subtasks/:gid` (digits-only gid; name/notes/html_notes scrubbed).
  - **Parser** `server/qaLoop/intake.ts` (pure, `npm run test:intake`) → an **intake pack**
    `{taskGid, title, suiteGid/suiteName, productGuess, cases[{caseKey, title, gid, url,
    completed, priority, preconditions, steps, expected, pass, fail, devices, environment,
    doNotFile, notes}], knownBehaviours, flaggedImperatives[{text, rule, source}],
    scopeIncomplete[{kind, reason, source, url?}], questionForAuthor, attachments, warnings,
    stats}`. Case key = spec regex `^[A-Z]{2,6}(-[A-Z0-9]+)+` at the start of the subtask
    name, **plus at least one digit** (so `QA-ONLY` is not a key; keyless subtasks still
    import, keyed by gid). Sections understood: Asana's plain rendering of rich notes
    (label + 4-space-indented items: `Steps    …`) and flat `Steps:` / `1.` lists; labels
    Steps/Endpoints, Pass(/Regression/Acceptance), Fail, Expected, Setup/Precondition,
    Devices, Environment, Do-not-file/Known behaviours/By design, `For the tester`
    (reset) and `For AI assistants` (kept as notes DATA + flagged `addressed-to-ai`).
    **Everything from Asana is data:** imperative lines (run on prod, approve, post to,
    use this token, send to, mark complete, merge/deploy, "ignore previous instructions")
    are returned **verbatim** (secret shapes redacted, flagged `secret-shaped-value`) and
    never acted on; unreadable sources (Slack DM/thread, claude.ai artifact, d.pr/Loom
    video, Google Doc, Figma, video attachments, "see Slack" with no link) and cases with
    no steps mark the pack scope-incomplete and draft ONE question for the author (never
    posted). `scrub()` is prose-safe (JWT, Bearer, gh_/sk-/xox/shpat/Asana/AWS tokens,
    `?token=`-style params with real-looking values) — qa-core `redact()` mangles ticket
    prose ("token revocation", "no code="), so it is not used here.
  - **Import route** `POST /api/tm/import/asana/:gid` (`tmImportHandler` in
    `server/api.ts`, mounted before `tmHandler`; same-origin + `X-TP-Nonce`). Body
    `{productId?, previewHash?, confirm?, actor?}`. **Preview-only unless `confirm:true`**:
    returns `{pack, plan:{actions[create|update|bind], suite, counts}, productId,
    productOptions, previewHash}` and writes nothing. Confirm re-reads Asana, refuses
    **409 `changed`** if the pack/product no longer matches `previewHash`, then
    `planAsanaUpsert` → `saveState(…, "asana-import-<gid>")` (prior state snapshotted)
    and returns the touched suites/cases + seq + activity, which the open client merges
    (`useTm.applyAsanaImport`) so its next save keeps them. Upsert (idempotent): match by
    `externalRef.gid` (update; only `source:"asana"` cases get their title/steps
    refreshed) → by `externalRef.caseKey` or display `key` (**bind**: attach
    `externalRef` + `asana` tag, keep curated title/steps/runs — this is how the seeded
    SL-* cases link) → else create `asana-<gid>` (key = caseKey, else `TC-n`) in suite
    `asana-suite-<parentGid>` named after the parent task under the product suite
    (`suite-<productId>`; guessed from the text, overridable in the preview). User-moved
    suites/cases keep their placement. Asana is never written.
  - **`TmCase.externalRef`** `{system:'asana', gid, parentGid, caseKey, url?, completed?,
    syncedAt?}` + `source:"asana"` (`src/tm/types.ts`).
  - **`@case` mapping** (`importFrameworkSpecs`): a spec whose title or tags carry
    `@case:<KEY>` binds to the TM case with that caseKey (`externalRef.caseKey`, else the
    display key) — sets automated + framework + `specFile:file:line` — instead of creating
    an `imp-` duplicate (first spec carrying a key wins; unmatched keys import normally).
    So `playwright test --grep @case:<KEY>` is that subtask's test, and the V1 verdict
    floor already BLOCKs any skipped `@case` test. Older `imp-` duplicates created before
    a spec was tagged are left in place (delete by hand). Spec tagging is done in the
    framework repos, not here.
  - **UI**: Test Cases → **Import from Asana** (`src/screens/tm/AsanaImportModal.tsx`):
    gid/URL → Preview (target suite + product select, a "this is data" banner, flagged
    text verbatim, scope gaps + copyable draft question, per-case action/steps/pass/
    devices, known behaviours, attachments) → **Confirm import**. Client
    `src/lib/asanaImport.ts`.
  - **Seeds kept (Phase 1):** the `src/tm/*Seed.ts` backfills still run. They are meant
    to be replaced by Asana imports (the SL-* seed cases already bind by key); remove a
    seed only after its Asana task has been imported and confirmed.
  - **DEMO labels:** the simulated cockpit flows — `runTestPlan` (Run tests / Re-run /
    Re-verify / Save & run / queue + overview Run/Verify), `simulateDevFix` and the
    pipeline's simulated `postAsanaComment` card — carry a **Demo** badge
    (`src/components/ui/DemoBadge.tsx`); they run on timers and write nothing.
- **D4 Fixtures view (2026-10, read-only).** `/fixtures` (admin + qa; sidebar
  **Automation & Delivery → Fixtures**, `src/screens/Fixtures.tsx`) lists the QA fixture
  registry `~/QA-Automations/config/fixtures.json`, grouped by **product · env**, with
  badges for `destructiveOk` (else "Read-only"), `singleUse` and `sharedWith` (count +
  ids), the identifiers (owner persona, store, site/account/business id, QB realm,
  identity label, siteKey **prefix**), capabilities and `verifyHint`. Entries whose
  `status` starts with `TODO` are highlighted as **Needs provisioning** (top callout +
  amber rows + the exact `[BLOCKED:FIXTURE/not-provisioned] …` line `getFixture()` throws).
  Env filter, search, "needs provisioning only". **Server:** `server/fixtures.ts`
  `listFixturesView()` loads through qa-core `loadFixtures` (same refusals the frameworks
  get: secret-shaped keys/values, duplicate ids, destructive production fixtures → **422**;
  missing file → **404**), returns an ALLOWLIST of fields only (unknown keys dropped —
  their names listed in `extraKeys`), masks `siteKey` to 8 chars, and re-runs
  `assertNoSecrets` on the outgoing payload (500, no content, if anything slips).
  Route `GET|HEAD /api/fixtures` (`fixturesHandler` in `server/api.ts`); every other
  method → **405 read-only**. There is NO write path — edit the JSON by hand (identifiers
  only) and press Reload. Path: `QA_FIXTURES_PATH`, else `<QA_ROOT or ..>/config/fixtures.json`.
  Client `src/lib/fixtures.ts`.
- `server/asana.ts` + `server/github.ts` + `server/slack.ts` — API clients for the
  dev middleware. Slack reads a QA channel's recent messages and surfaces the ones
  that read as a build/PR hand-off.
- **QA Log** (`/qa-log`, qa+admin, sidebar): a **durable** record of every task
  QA verified & closed — `closeTask` appends a `QaLogEntry` (task, PR, origin,
  closedBy, closedAt, Asana write-back result) to `testpilot.qaLog` in
  localStorage (`src/lib/qaLog.ts`; store `qaLog` slice). Survives reloads —
  unlike task status, which is in-memory and reloads fresh from connectors (a
  completed task drops off the live queue, so this is the only lasting record on
  the TestPilot side; Asana remains the source of truth for "completed").
- **Reports** (`/reports`, qa+admin, sidebar): "what was tested, against which PR
  or task" — a reporting hub with four sections: (1) **Verified & closed** joins
  the `qaLog` with live `tasks` to show, per PR/task, what was tested (test count
  · scenarios · specs from `qaAuthoring`) + a source link; (2) **Automation run
  history** — every runner run is now **persisted** (`recordHistory` →
  `<TestPilot>/.testpilot-runs.json`, `listRunHistory`) with an optional
  **`taskRef`** ({taskId?, pr?, label?}) so runs trace to a PR/task; (3) an
  **on-demand tagged report builder** (pick framework + PR/task tag → runs
  **`test:smoke:report`** in `command` mode via `startPlaywrightRun`, which
  actually GENERATES a full HTML report grouped by critical functionality — the
  runner passes the tag as `SMOKE_TASK_REF` so the report is stamped with the
  PR/task); (4) an index of the on-disk smoke reports the suites write to
  `<framework>/smoke-reports/` (`server/reports.ts`
  `listSmokeReports`/`readSmokeReport` — read-only, path-guarded; each report's
  verdict/env/PR-task are parsed from its head), opened in an in-app iframe
  viewer. The report reporter (`reporters/smoke-report.js`) + a
  `test:smoke:report` script are wired into **all 8 frameworks**, so any product
  can generate a report. Middleware `testpilot-reports-api`
  (`/api/reports/history|smoke|smoke/file`); client `src/lib/reports.ts`; screen
  `src/screens/Reports.tsx`. `RunRequest.taskRef` flows through the runner so any
  run (Test Runner / Scheduler / builder) is traceable. **Flaky diagnostics
  (2026-07, a 4th Reports section):** `server/flaky.ts` `listFlaky()` aggregates
  per-test outcomes across the `.testpilot-detail-*.json` run-story files (flaky =
  a test that both passed AND failed across runs, or recovered on a retry within a
  run) → `GET /api/flaky/list`. `diagnoseFlaky(creds,{runId,spec?,title?})` feeds
  the test's source + its Run-Story trace (error/steps/stdout/retry) + a local
  pitfall catalogue (`server/flakyPitfalls.ts`: hash-route, off-viewport, Cloudflare/
  Turnstile, iframe frameLocator, CDP color-picker, etc.) to Claude via aiTest's
  `sendMessage` → a structured {category, matchedPitfall, rootCause, evidence,
  suggestedFix, confidence} — so it hits the SAME Anthropic 402 gate as Ask AI /
  QA authoring. Middleware `testpilot-flaky-api` (`/api/flaky/list|diagnose`, the
  diagnose route is AI-cred-gated + same-origin); client `src/lib/flaky.ts`
  (+ `rerunToConfirm(fw,spec,n,…)` — re-runs a spec N× through the runner in spec
  mode to measure a pass rate). Surfaced as the **Flaky tests** section on Reports
  (per-test pass rate + last error + **Diagnose** [AI] + **Re-run 5×** + link to the
  run story). Detection populates only from spec/smoke/full runs (command-mode
  scheduled runs carry no per-test story trace yet).
- **Close → Asana write-back:** a Verified task shows a **"Close task"** button
  (TaskDetail) → confirm → store `closeTask` sets a terminal `closed` status and,
  for Asana-origin tasks, makes a **REAL** Asana write (`completeTask` →
  `PUT /tasks/{gid}` `{completed:true}` via `POST /api/asana/complete-task`;
  client `completeAsanaTask`). Confirm-gated (dialog warns it's a real update).
  Task status is in-memory only, so it resets on a dev-server restart — the Asana
  write is the durable part.
- **Asana comment write-back:** `addComment` in `server/asana.ts` (`POST
  /tasks/{gid}/stories` with `html_text`) → `POST /api/asana/comment`
  `{gid, text, mention?}`; client `postAsanaComment`. `mention` (a name) is
  resolved to a real `<a data-asana-gid>` @mention by matching the task's
  creator/followers, so QA can post a status back to the dev (real, notifies them).
- `src/lib/asana.ts` + `src/lib/github.ts` + `src/lib/slack.ts` — map Asana tasks /
  GitHub issues / Slack messages onto the internal `Task` model (`src/types.ts`,
  discriminated by `Task.origin`).
- **Test stores** (`src/data/stores.ts` → a "Test stores" section on Integrations):
  the team's Shopify-embedded QA apps (PushEngage + LedgerPort, staging + prod,
  all Free plan) as reference bookmarks + the Shopify Partner dashboard link.
  The apps sit behind Shopify admin login (embedded cross-origin iframe — not
  drivable by Claude-in-Chrome, so driven via Playwright `frameLocator` + a
  captured session). Both Shopify apps now have Playwright frameworks:
  `pushengage-shopify-revamped` and `ledgerport-shopify` (Shopify→QuickBooks
  sync), both in the Test Runner registry.
- `src/store/useStore.ts` — Zustand store; `loadAsana`/`loadGithub`/`loadSlack`
  each fetch their source and replace only their own-origin tasks (race-safe).
- `src/screens/` — routed pages; `src/screens/taskDetail/` — task-detail subviews.

## Env vars

`ASANA_ACCESS_TOKEN`, `ASANA_WORKSPACE_GID` (optional), `GITHUB_TOKEN`,
`GITHUB_REPO` (optional, `owner/repo`), `SLACK_BOT_TOKEN`, `SLACK_QA_CHANNEL`
(optional, defaults to `qa-automation`), `ANTHROPIC_API_KEY` **or**
`ANTHROPIC_AUTH_TOKEN` **or** an `ant auth login` profile (any one enables the
Manual Test "Ask AI" prompt). `TP_ALLOWED_HOSTS` (optional, comma-separated exact
`host:port` values added to the G3 Host allowlist). `QA_FIXTURES_PATH` (optional; overrides
the D4 fixture registry path read by `/api/fixtures`). `TP_SESSION_CANARY=0` disables the I1
session canary; `TP_CANARY_NOTIFY=0` keeps it but mutes the macOS notifications. Any connector with no token degrades gracefully
(connectors → sample data; AI → disabled prompt). See `README.md`.
