# TestPilot refine — design spec (2026-10-20)

**Status:** approved in brainstorming on 2026-10-20 (design parts 1 + 2, approach A). Discovery is in `AUDIT.md` (same folder); this spec records the decisions and the design. The implementation plan is `PLAN.md`.

## 1. Intent

**The user's words:** "a stupid simple, easy to use TestPilot for automating the PushEngage, LedgerPort products, Shopify and WordPress plugins and mobile SDKs, keep the playwright test cases, and refine rest that you think, also keep in mind the CI/CD pipeline."

**Success means:**
- TestPilot runs at `http://localhost:5173` (LaunchAgent `com.testpilot.dev`) with a 5-item nav.
- Every kept feature works.
- All checks are green (§8).
- A real public smoke run returns an honest verdict.
- The 4 Sun/Wed schedules are intact.
- A CI workflow is prepared for review, uncommitted and unpushed.
- CLAUDE.md, the `testpilot-qa` skill and memory match the new app.

## 2. Decisions (user, 2026-10-20)

| # | Question | Decision |
|---|---|---|
| D1 | Login and accounts (U12) | **Keep + fix.** Keep the login gate, roles and server auth for the hosting/team plan. Remove the "Forgot password?" self-reset (it resets any account, admin included, from just an email); an admin resets passwords from Settings → Users. Users becomes a Settings tab. The Database unlock screen goes, replaced by Settings → Data (admin-only). `server/index.ts`, `server/authStore.ts` and `HOSTING.md` stay as they are. `TestPilot-HostReady` is archived and left in place. |
| D2 | CI home | **Public `KulvinderGosal/QAAutomations`**, with 3 legs: `pushengage-site test:scheduled:prod`, `ledgerport-marketing-site test:scheduled:prod`, `ledgerport-saas-automation test:public`. |
| D3 | Old launchd smoke monitors | **Retire after the swap.** Archive the `com.awesomemotive.qa.smoke-all` and `smoke-auth-ctas` plists, then unload them. The user confirms again at that moment. |
| D4 | Removal list | **Confirmed in full**, including Performance, the lifecycle modules (Plans/Runs/Requirements/Traceability/Releases/Defects/Risks), SKB Docs and the V2a Asana intake. |
| D5 | Scheduled alerts (assumption, uncorrected) | Keep the Slack `postMessage` path (it posts once `SLACK_BOT_TOKEN` is set) **and** add a macOS notification for every scheduled FAIL/BLOCKED. Only the Slack QA-channel queue sync is deleted. |
| D6 | Approach | **A — copy, prune in the audit's landing order, sync back.** |

## 3. Target app

### 3.1 Navigation and shell

- **Nav (5):** Products `/` · Test Cases `/tests` · Runs `/runs` (+ `/runs/:id`) · Schedules & CI `/schedule` · Settings `/settings`.
- **Routing:** every retired route redirects to `/`, through a catch-all `*` route.
- **Header:**
  - brand toggle (PushEngage / LedgerPort / All), honoured by all 4 content screens;
  - SessionBadge, linking to `/settings?tab=sessions`;
  - theme toggle;
  - a "DB offline — changes not saved" banner (R5).
  - No bell, no global search.
- **Roles (login kept):** `/`, `/tests` and `/runs` are open to all roles. `/schedule` is qa+admin. `/settings` is qa+admin; its Users and Data tabs are admin-only. `ROUTE_ROLES` gets explicit entries for every route, so nothing falls through to the `ROLE_ORDER` default.

### 3.2 Products (`/`)

- **Cards:** one per **product**, grouped by `productId` from the server registry (R4). That gives 10 cards:
  - PushEngage: marketing site, app dashboard, WP plugin, Shopify, Android SDK, iOS SDK;
  - LedgerPort: marketing site, SaaS, WP plugin, Shopify.
- **Framework ids stay unchanged** (run history and the 61 device-case bindings reference them):
  - `iam-android` is relabelled "PushEngage Android SDK (IAM)".
  - `iam-ios` is relabelled "PushEngage iOS SDK".
  - `pushengage-android-sdk` stays a registry entry with `productId: "pe-android-sdk"`, so its Maestro scripts show on the same Android card.
- **Each card shows:**
  - the last local verdict (state + reason + human action, via `verdictNote`);
  - a CI chip (only for products with a CI leg);
  - a persona chip (ok/warn/block) with a copyable capture command;
  - the next scheduled fire;
  - the latest master commit (read-only).
- **One Run control** per card:
  - modes: Smoke | Full | Spec… (spec picker) | Script… (npm scripts, command mode) | Flow… (mobile);
  - plus env and headed;
  - if the card has several frameworks, a framework picker.
  - Production env asks for a ConfirmDialog first.
  - It never sends `sessionGate:false`.
- **Top banner:** "N sessions need you", counting active personas only (R9), each with its capture command.
- **Bottom:** the shared RunPanel, docked.

### 3.3 Test Cases (`/tests`)

- **Kept:**
  - the existing suite tree and case list, filtered to Automated by default (with an "All" toggle);
  - select-all, Run, Run selected (sequential), Stop, Run on device;
  - Import from frameworks;
  - suite add/rename/clone/move/delete;
  - the case modal (steps, verdict notes, history).
- **Added (R8):**
  - the docked RunPanel while a case run is active;
  - history rows linking to `/runs/:id`;
  - a status-count strip;
  - a ConfirmDialog before Run selected on production;
  - device runs mapped through the verdict floor (`tmStatusFromVerdict`);
  - one cheap independent status poll per case run (`offset=999999999`) instead of the duplicate full-output poll;
  - a run-id guard in `pollRunnerRun`.
- **Import refresh (R8.8):**
  - Cases are matched by framework + file + title, so history carries forward when line numbers shift.
  - Missing cases are tagged `stale` (never moved or deleted).
  - The stale pass is refused if `--list` errors or more than 20% of a framework's cases would go stale.
- **Removed:** QA Copilot, Import from Asana, plan/requirement fields, comments/review, the DeviceRunReports modal.

### 3.4 Runs (`/runs`, `/runs/:id`)

- The history table from `/api/reports/history`, filterable by product, verdict and source (manual / scheduled / case).
- Self-test runs are hidden.
- Each row opens the Run Story (`/runs/:id`).
- Runs replaces Reports and the QA Log.

### 3.5 Schedules & CI (`/schedule`)

- **Local schedules:** list, create, **edit cadence** (new route that keeps `lastRun*`/`blockedOn`), toggle, run now, delete. Each shows its last verdict and its session-blocked state.
- **CI panel:** read-only, for the 3 legs (§6). It shows the latest runs from `GET /api/ci/status` and links to GitHub. Until the workflow is pushed it shows "workflow not found".
- **Removed:** the free-form "run any npm script" terminal (U17); Script… on Products covers it. Pipelines (U7) is removed too: it has 0 runs ever, and this screen replaces it.

### 3.6 Settings (`/settings`)

| Tab | Content |
|---|---|
| **Sessions** | The Test sessions panel moved from TestRunner: per-persona state, Re-probe, Verify live, Copy capture cmd. Inactive personas (`ledgerport-shopify:billingpagetesting-2`, `:silverlisting`) are shown as "inactive", stay registered, and don't count toward the badge or banner. |
| **Fixtures** | The read-only registry view, moved from `/fixtures`. |
| **Data** (admin) | TM backups (reason, counts, size) with restore behind a ConfirmDialog and a nonce. Export of the current state. A one-time export of the localStorage `testpilot.qaLog` and `testpilot.savedTests`. |
| **Users** (admin) | Own profile + team CRUD + roles (the old `/users` screen) and admin password reset. |

### 3.7 Removed (all archived first; paths in AUDIT.md Appendix A)

| Unit | What goes |
|---|---|
| U1 | The simulated cockpit, `mock.ts` fixtures, the notification bell |
| U2 | Overview, QA Queue, Task Detail, QA Log, Integrations, the Asana + Slack-sync connectors, the GitHub issue/PR/comment/close routes |
| U3 | The in-app AI layer (`@anthropic-ai/sdk`, `exceljs`) |
| U4 | SKB Docs |
| U5 | The TestCollab modules + the quality-metrics row |
| U6 | Performance |
| U7 | Pipelines |
| U8 | Manual Test (the qa-core target guards stay) |
| U9 | The Reports extras (builder, smoke-report viewer, Verified & closed, Flaky) |
| U10 | The device-run report store + the `deviceRuns` slice |
| U11 | The Asana intake + `externalRef` |
| U13 | The seed source files + 11 backfills; `IAM_IOS_ASSERT` + `IosAssert` move next to `assessIosRun` |
| U14 | The TM Dashboard, Donut, the HTML activity feed |
| U15 | The stale root workflows (archived; replaced by `qa-fleet.yml`) |
| U17 | The Scheduler terminal |
| U18 | Dead exports and unused deps |

`tsx` and `@playwright/test` stay.

**U12 is cancelled per D1**, but `Database.tsx` and the self-service reset still go.

### 3.8 Kept untouched in behaviour

- the runner core and its modes;
- `story-reporter.cjs`;
- the V1 verdict floor;
- the I1 session gate and canary;
- the scheduler, and `startSchedulerWithAlerts` (vite.config.ts:25);
- run history and the Run Story;
- the TM SQLite store;
- the G3 guards;
- `packages/qa-core`;
- the Fixtures view;
- the mobile harnesses;
- the GitHub latest-commit lookup;
- the theme tokens and primitives;
- the `GET /api/session/nonce` route, which the sessions probe and restore still use.

## 4. Safety and swap

### 4.1 Archive first (R1)

Everything goes into `~/QA-Automations/_archive/testpilot-2026-10-20/` (gitignored, never committed):
- TestPilot source (excluding `node_modules`, `dist`, `.env`, `.auth`);
- `packages/qa-core` and `config/`;
- every `.testpilot-*.json` (schedules, runs, sessions, detail files);
- the 5 root `.github/workflows` files and `TestPilot-HostReady` (excluding `node_modules` and `dist`);
- the 3 LaunchAgent plists and `testpilot-device-reports/`;
- a **`sqlite3 .backup`** of `testpilot-tm.db`, verified by opening it and counting the backup rows and cases;
- a `GET /api/tm/state` JSON export.

The existing `~/Backups/testpilot/*pre-refine*` files stay.

### 4.2 The working copy

- **Copy:** `~/QA-Automations/TestPilot-next`, an APFS clone (`cp -c -R`) of the live folder.
- **Env in the copy:**
  - `PORT=5174`;
  - `TP_TM_DB=<archive>/testpilot-tm.next.db` (a `.backup` copy);
  - `TP_SCHEDULER=0` (new env: no ticker, no canary arming);
  - `TP_SESSION_CANARY=0`;
  - `TP_CANARY_NOTIFY=0`.
- **New code supporting the copy (both stay in the final app):**
  - `server/tmStore.ts` reads `TP_TM_DB`, falling back to `~/QA-Automations/testpilot-tm.db`.
  - `startSchedulerWithAlerts` honours `TP_SCHEDULER=0`.
- **Its own launch config:** `testpilot-next` on 5174.
- **Running real tests from the copy:** never while live has a run in flight, and never within ±2 h of Sun/Wed 08:00 IST. The copy and live share the framework folders.

### 4.3 The swap

1. **Gate:** all §8 checks green on the copy, plus one real public smoke (`pushengage-site` or `ledgerport-marketing-site`) from the copy with an honest verdict. Live `GET /api/runner/runs` shows nothing running, and it is outside ±2 h of Sun/Wed 08:00 IST.
2. Re-archive the live `.testpilot-*.json` files and run a fresh `sqlite3 .backup` (delta).
3. `rsync -a --delete` the source files from TestPilot-next into TestPilot. Excluded: `.env`, `.auth/`, `.testpilot-*.json`, `node_modules/`, `dist/`, `.claude/launch.json` (written separately).
4. In TestPilot: `npm install`, so the removed deps leave.
5. `launchctl kickstart -k gui/$(id -u)/com.testpilot.dev`.
6. **Verify:** all 5 screens load with 0 console errors. `/api/schedule/list` still shows the 4 jobs with their `nextRunAt`. The DB has its `rev` column. One public smoke returns an honest verdict.
7. **After the swap:**
   - `.claude/launch.json` `testpilot-dev` becomes a url-only attach to `http://localhost:5173`.
   - With the user's confirmation: archive and unload the two old smoke LaunchAgents (D3).
   - With the user's confirmation: run the U13 DB prune (§5.2).
   - Delete `TestPilot-next`.

**Rollback:** rsync the source back from the archive, `npm install`, `kickstart -k` (about 2 min).

## 5. Data integrity

### 5.1 R5 — no silent overwrites

1. An idempotent migration adds `rev INTEGER` to `tm_state`.
2. `GET /api/tm/state` returns `rev`. `POST /api/tm/save` requires `baseRev` and answers **409 `{rev}`** on a mismatch.
3. On a 409 the client re-hydrates. If its last mutation was a verdict write-back it re-applies it; otherwise it shows a conflict toast. It never auto-forces.
4. Scripted saves use GET → `baseRev` → POST. For bulk edits, `force:true` is allowed with a reason starting `script:` or `prune:`.
5. The case-count hydrate-reconcile (`src/tm/store.ts:~1271`) is **deleted**.
6. **Server unreachable:** the app goes read-only, the header shows the banner, and a retry queue re-tries hydrate and pending saves. `pushToServer` is never armed on a stale mirror.
7. **Mirror:** the full localStorage state mirror is dropped. Debounced per-case saves stay; bulk runs still persist per case.
8. **Mass drops:** `saveState` refuses a drop of more than 90% unless the reason starts with `prune:` or `restore-`.

### 5.2 U13 — prune seeds, after R5 is live

- The seed sources and backfills leave the code.
- `seed()`, for an empty DB, only creates the product suites from the registry.
- **The DB prune happens after the swap,** once every old tab has been reloaded. It is one confirmed save with reason `prune:placeholder-seed-cases+0922-dedupe`. It deletes `seedcase-1..4` and re-applies the 2026-09-22 dedupe of the 52 duplicate `imp-` cases and the `imp-suite-pushengage-app-dashboard-in-app-campaigns` suite.

### 5.3 R10 — bounded DB growth

- **Tiered retention:** the last 10 snapshots, plus 1/day for 14 days, plus 1/week for 8 weeks. Snapshots with a named reason (anything except `save`/`hydrate-reconcile`) are always kept, and backup #10 is pinned.
- **Compression:** new snapshots are stored gzip-compressed. `restoreBackup`, `listBackups` and `counts()` read both plain and gzip formats.
- **After each write:** `PRAGMA wal_checkpoint(TRUNCATE)`, and one `VACUUM` after a prune.
- **Order:** prune only after the R1 `.backup` has been verified restorable.
- **Restore:** `POST /api/tm/restore` requires `X-TP-Nonce`, and the client uses `fetchWithNonce`.

### 5.4 R11 — bounded run files

- Run Story screenshots move from inline base64 to files under `~/QA-Automations/testpilot-run-evidence/<runId>/`. That directory is durable, not tmpdir.
- A 25 MB total cap applies alongside `MAX_DETAIL_FILES=60`, but only after the screenshots have moved.
- History entries past 200 rotate into `.testpilot-runs-YYYY-MM.json` instead of being dropped.

## 6. CI (R6) — public `KulvinderGosal/QAAutomations`

### 6.1 Delivery

- **Where:** a separate worktree, `~/QA-Automations/_ci-qa-fleet`, on a new branch `ci/qa-fleet` from `main`. The shared root checkout's branch is never switched.
- **State:** files staged there, **uncommitted, unpushed**, for the user's review.

### 6.2 `.github/workflows/qa-fleet.yml`

- **Triggers:**
  - `schedule: cron '0 7 * * 0,3'` (12:30 IST Sun/Wed, offset from the local monitors);
  - `workflow_dispatch` with a `leg` choice input, and a `script` input passed via `env` and checked against an allowlist.
  - **No `pull_request` / `pull_request_target`.**
- **Settings:** `permissions: contents: read`. Actions pinned by SHA. Node 22.
- **Job:** `qa (${{ matrix.id }})` with `fail-fast: false`, `timeout-minutes: 45` and `concurrency: qa-${{ matrix.id }}`.

| Leg id | Source | Script |
|---|---|---|
| `pushengage-site` | `pushengage-site/` in this repo | `test:scheduled:prod` |
| `ledgerport-marketing-site` | checkout of `awesomemotive/pushengage-ledgerport-site` using secret `LP_SITE_READ_TOKEN` (a fine-grained, read-only PAT) | `test:scheduled:prod` |
| `ledgerport-saas-automation` | `ledgerport-saas-automation/` in this repo | `test:public` |

- **Steps:**
  1. `npm ci` and `npx playwright install --with-deps chromium`.
  2. `npm run <script> -- --reporter=list,json`, with `CI=1` and `PLAYWRIGHT_JSON_OUTPUT_NAME=${{ runner.temp }}/results.json`.
  3. `node --import tsx $GITHUB_WORKSPACE/TestPilot/scripts/ci-verdict.ts …`, with `tsx` pinned in a tiny CI install.
- **Never set** `SUBMIT_FORMS`, `SMOKE_SUBMIT_FORMS`, `ALLOW_PROD_FORM_SUBMIT`, `RUN_MANUAL_OTP` or `SIGNUP_PASSWORD`. Trace and video stay off.
- **Artifacts:** only `verdict.json`, kept 14 days. No `playwright-report`, results JSON or traces, because the repo is public.

### 6.3 `TestPilot/scripts/ci-verdict.ts`

- A ~40-line wrapper over the pure `deriveVerdict`.
- **A missing or empty JSON is BLOCKED{HARNESS}**, never PASS.
- Writes `verdict.json` and a `$GITHUB_STEP_SUMMARY` table.
- Emits `::notice title=TP_VERDICT::{"state":…,"executed":…,"cls":…}`.
- **Exit codes:** 1 only on FAIL. BLOCKED exits 0 with `::warning`.

### 6.4 Files published to the public repo (after a scan)

- `pushengage-site/` and `ledgerport-saas-automation/` (framework code only);
- `TestPilot/server/qaLoop/verdict.ts`, `TestPilot/scripts/ci-verdict.ts`;
- `packages/qa-core/errors.ts`;
- the workflow;
- root `.gitignore` additions: `config/`, `testpilot-qa-records/`, `testpilot-device-reports/`, `testpilot-run-evidence/`, `TestPilot-HostReady/`, `**/smoke-reports/`, `**/.auth/`, `**/.env*`.

**The scan:** a secret scan (gitleaks or an equivalent regex sweep) plus an identifier sweep over account emails, site/realm ids and the admin hash. Any hit blocks publishing until it is resolved with the user.

### 6.5 TestPilot side

- **Route:** read-only `GET /api/ci/status` in `server/github.ts`, configured by `TP_CI_REPO` (default `KulvinderGosal/QAAutomations`) and `TP_CI_WORKFLOW` (default `qa-fleet.yml`).
- **What it reads:** the last 5 workflow runs → their jobs → each job's check-run annotations. It maps `qa (<id>)` to a framework id and takes the `TP_VERDICT` annotation.
- **Result:** `[{framework, verdictState, executed, conclusion, startedAt, durationSec, htmlUrl}]`, cached 5 min, needing only `GITHUB_TOKEN` read access.
- **Chip:** green only when `verdictState === "PASS"` with `executed > 0`.
- **Not in scope:** a "Run in CI" button (a write) and automatic disabling of local schedules.

## 7. Monitors and sessions

- **R7.1** Scheduler-fired runs are spawned under `caffeinate -i -w <pid>`. Lid-close sleep is still handled by the verdict floor.
- **R7.2** Stagger, through the new cadence-edit route: Sun/Wed LP marketing at 08:00, PE site at 10:00.
- **R7.3** `watchRunForAlert` waits for a terminal status instead of giving up after 60 min.
- **R7.4** Every scheduled FAIL/BLOCKED raises a macOS notification, plus a Slack post when the token is set. `/api/schedule/alert-status` returns `{ready:true, channels:["macos", …]}`, so the skill's `ready` branch still works.
- **R7.5** Add `,json` to the `--reporter` of both prod scripts. In `ledgerport-sites/pushengage-ledgerport-site` (the nested awesomemotive repo) that is a local edit only, flagged for review. A red-test triage report is produced from the last 10 scheduled runs; **no test is quarantined without the user's OK.**
- **R7.6** A scheduler lock file `.testpilot-scheduler.json` (`{pid, startedAt}`):
  - The owner is `process.pid`, so a Vite in-process restart re-acquires its own lock.
  - A stale lock (dead pid, or pid reuse with a different start time) is taken over.
  - A live foreign lock disables the ticker and shows "scheduler disabled: lock held by pid N" in `/api/schedule/list`.
  - It is covered by the existing `**/.testpilot-*.json` watch-ignore.
- **R9** Only active personas (those used by a framework's `defaultEnv` or by an enabled schedule) count toward the badge and banner. Blocking personas show their capture command. The canary's notification names the capture command.
- **R13** `requestGuard` refuses cross-site GETs (`Sec-Fetch-Site: cross-site` or a foreign Origin) on `/api/runner/specs?refresh=1` and on `/api/sessions` without `cached=1`.

## 8. Verification

**After every task**, on the copy:

```bash
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run lint
npm run test:verdict
npm run test:intake        # until U11 removes intake
npm run test:contract      # new, R2
npm run build
```

Then every surviving screen is loaded on `http://localhost:5174` with **0 console errors**.

- **`test:contract` (R2):**
  - Mounts `mountAll` on an ephemeral port with a temp cwd, temp HOME and temp `TP_TM_DB`, stubbed runner/scheduler/session spawns, and `cached=1`. It can never touch live state, spawn a probe or send a notification.
  - Asserts the shapes of the routes the skill and scripts use (runner frameworks/runs/run detail/scripts, reports history, sessions, schedule list/create/run/toggle/cadence/alert-status, tm state/save with `baseRev` → 409).
  - Asserts the G3 refusals (421 host, 403 origin, bad nonce).
- **`tsconfig.node.json`** includes `server/**/*.ts`.
- **Aggregate script:** `npm test` = verdict + contract (+ intake while it exists).
- **Final steps:** `superpowers:requesting-code-review` over the full diff (copy vs archive), then the R12 docs/skill/memory refresh. The R12 file list is in AUDIT.md R12, plus the verifier additions.

## 9. Constraints

- **No external writes:** no git push, no Asana/GitHub/Slack posts. The CI branch is for review only. Never print `.env` values or tokens.
- **No commits** unless the user asks.
- **Live folder:** never edit `~/QA-Automations/TestPilot` before the swap. The only exceptions are this spec and the plan (docs, which cause no restart).
- **QA Log:** export it (Settings → Data, or DevTools on :5173) before the U2 build is swapped in.
- **Keep the two devDeps:** `tsx` and `@playwright/test` are used by other repos.

## 10. Out of scope

- Wiring the client to `/api/auth` and the hosting/VPS work (INC-2b+).
- Pushing anything, and adding "Run in CI".
- Quarantining tests without OK.
- Auto-disabling local schedules when CI is green.
- Removing `TestPilot-HostReady` from disk.
