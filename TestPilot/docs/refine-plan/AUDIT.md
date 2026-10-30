# TestPilot refine plan — audit results (2026-10-20)

**Goal (the user's words):** "A stupid simple, easy to use TestPilot for automating the PushEngage, LedgerPort products, Shopify and WordPress plugins and mobile SDKs. Keep the Playwright test cases, and refine the rest. Also keep in mind the CI/CD pipeline."

**Where this came from:** a 14-agent, read-only audit. It inventoried the frontend, server, stores and seeds, and checked them against real usage (run history, the TM SQLite DB, 61 session transcripts, memory, skills) and against code health. Three independent design lenses (minimalist, workflow-fit, risk) proposed changes, a lead merged them to the user's direction, and three adversarial verifiers (dependencies, data safety, counter-evidence) checked the result. The full machine output is in `audit-full.json` next to this file. Every removal unit and refinement below carries its complete path list and the verifiers' notes (Appendix).

**Backups taken before anything changed:** `~/Backups/testpilot/testpilot-src-pre-refine-2026-10-20.tgz` (TestPilot + packages/qa-core + config) and `~/Backups/testpilot/testpilot-tm.db*.pre-refine-2026-10-20`. Most of TestPilot is **untracked in git**, so these backups are the only undo for deletions.

---

## 1. The target: 5 screens

| Nav | Route | What it is | Replaces |
|---|---|---|---|
| **Products** | `/` | One card per product surface (10, from the server registry): PE marketing site, PE app dashboard, PE WP plugin, PE Shopify, PE Android SDK, PE iOS SDK, LP marketing site, LP SaaS, LP WP plugin, LP Shopify. Each card shows the last honest verdict (state + reason + human action), the CI chip, the session/persona chip with a copyable capture command, the next scheduled run and the latest master commit. It has **one Run control** (Smoke / Full / Spec… / Script… / Flow… for mobile, plus env and headed). The shared RunPanel is docked at the bottom, and a "N sessions need you" banner sits at the top. | TM Dashboard, Overview, Test Runner, Pipelines cards |
| **Test Cases** | `/tests` | The existing suite tree and case list (~2.5k imported Playwright cases + mobile/manual cases), filtered to Automated by default. Keeps run one, Run selected, Stop, Run on device, Import from frameworks, and suite add/rename/clone/move/delete. History rows link to the Run Story. | TestCases (minus Copilot, Asana import, plan/requirement fields) |
| **Runs** | `/runs`, `/runs/:id` | The run history table (filter by product, verdict and source) linking to the Run Story evidence view. | Reports, QA Log |
| **Schedules & CI** | `/schedule` | Local scheduled monitors (create/toggle/run-now/delete, last verdict, session-blocked state) plus a **read-only GitHub Actions status per product**. | Scheduler, Pipelines |
| **Settings** | `/settings` | Tabs: **Sessions** (per-persona state, Re-probe, Verify live, Copy capture cmd), **Fixtures** (read-only registry), **Data** (TM backups + restore + export). | Test sessions panel, Fixtures, Database, Integrations |

Header: brand toggle (PushEngage / LedgerPort / All), SessionBadge, theme toggle. No bell and no global search.

## 2. What stays (load-bearing — do not remove)

- All Playwright frameworks and their test cases, plus `importFrameworkSpecs` and the `@case` binding.
- The runner core (`server/runner.ts`: spec/smoke/full/command + maestro/ios modes, one run at a time, stdout drain, history/detail files), `reporters/story-reporter.cjs` and RunPanel.
- The V1 honest verdict floor (`server/qaLoop/verdict.ts` + tests + fixtures).
- The I1 session gate and canary (`server/sessions.ts`, SessionBadge).
- The scheduler and its Sun/Wed monitors. **`startSchedulerWithAlerts` at `vite.config.ts:25` starts the scheduler ticker and the session canary, so it must stay.** The audit plan wrongly listed it as a "Slack link".
- Run Story and run history; the TM Test Cases core; the SQLite store; the G3 guards; packages/qa-core; the Fixtures view; the mobile harnesses (iam-android Maestro, iam-ios sim); GitHub latest-commit; theme tokens and primitives.
- **Cross-repo dependencies:**
  - TestPilot's `tsx` binary runs `auth:probe` in 5 frameworks and qa-core's selftest.
  - TestPilot's `@playwright/test` is the typeRoot for qa-core's tsconfig.
  - Do **not** remove either devDependency.

## 3. What goes (18 units — full paths in the Appendix)

| Unit | Removal | Verifier status |
|---|---|---|
| U1 | Simulated cockpit layer, mock fixtures, notification bell (~750 LOC of useStore + mock.ts). *One fake path ends in a REAL Asana write: simulated "verified" → Close task → completed:true.* | safe |
| U2 | Task/connector cockpit: Overview, QA Queue, Task Detail, QA Log, Integrations, Asana/Slack connectors, GitHub issue routes | **needs fixes**: keep the scheduler start + `postMessage` for Slack alerts; export the QA Log before deletion; land after U4/U5/U9/U11 |
| U3 | In-app AI layer (Copilot, QA authoring/auto-author/Excel, Hand to AI, coverage gap, Ask AI/Generate spec). It has been 402-gated (unfunded key) since July. | needs ordering (after U4, U5, U9) |
| U4 | SKB Docs (creds were never set; the XML-RPC POST is blocked by the host) | safe |
| U5 | TestCollab modules: Test Plans, Test Runs, Requirements, Traceability, Releases, Defects, Risks, quality-metrics row (**0 rows in the live DB and in all 19 backups**) | safe |
| U6 | Performance load tester | safe |
| U7 | Local Pipelines | **only after R6 CI is live**, or fold the stage orchestration into Schedules & CI |
| U8 | Manual Test ad-hoc runner | needs fixes (keep TestPilot's `@playwright/test`; adhoc/ guard code) |
| U9 | Reports extras: report builder, smoke-report viewer, Verified & closed, Flaky tests | safe |
| U10 | Device-run report store (`/api/devrun/*`) + the never-read `deviceRuns` slice | safe |
| U11 | Asana intake import (V2a) + `externalRef` (0 imported) | safe (land with/after U2) |
| U12 | Login, Users & Team, Database unlock, roles, server auth, prod server, TestPilot-HostReady | **DECISION 1** (default KEEP per the evidence; always archive HostReady) |
| U13 | TM seed source files, the 11 backfills, the 4 placeholder seed cases | **only after R5**: the hydrate-reconcile bug (below) must be fixed first |
| U14 | TM Dashboard, Donut, HTML activity feed (replaced by Products) | safe (after R3) |
| U15 | Stale root GitHub Actions workflows | safe, but **archive first**: 4 of the 5 were never committed, so deleting them is permanent |
| U16 | pushengage-android-sdk registry entry | **don't delete**: fold its 7 Maestro flows into the PE Android SDK card |
| U17 | Scheduler free-form "run any npm script now" terminal | safe |
| U18 | Dead exports, dead store actions, unused npm deps | safe (keep `tsx` and `@playwright/test`) |

Approximate effect: about 20k of ~34.5k src+server lines, about 35% of the 1.07 MB bundle and about 12 npm packages go. The nav drops from 22 items to 5.

## 4. Real bugs the audit found (fix these whatever else happens)

1. **Data loss via hydrate-reconcile** (`src/tm/store.ts:1271`). On 2026-09-22 the user's "dedupe-iam-dashboard" removed 52 duplicate `imp-` cases. Seven minutes later a stale browser tab's hydrate-reconcile wrote the old 2960-case mirror back, so the 52 duplicates are in the live DB again. The fix is R5: rev/baseRev optimistic concurrency, with no silent overwrite of the shared DB.
2. **A fake verdict can trigger a real write.** Simulated `runTestPlan` in verify mode, or the scripted `runQaPipeline`, sets `status='verified'`. That unlocks **Close task**, which does a real Asana `PUT completed:true`. Removed by U1/U2.
3. **"Forgot password?"** (`src/screens/Login.tsx:56-75`) resets any account, admin included, from just an email. Fix it if U12 is kept.
4. **Monitors can be dishonest or collide.** Two schedules fire at 08:00 on both Sunday and Wednesday. A BLOCKED leg must not read as success. See R7.
5. **The DB grows without bound** (49 MB: full-state backup snapshots on every write). See R10. Don't gzip legacy backups; keep backup #10, the only deduped snapshot.
6. **Every root CI workflow is dead.** `smoke-tests.yml` (the only tracked one) is manual-trigger only since 2026-02-23, and the rest point at the pre-reorg layout. See R6.

## 5. Decisions for the user (ask these in brainstorming, before any deletion)

1. **Login and accounts (U12).** TestPilot listens only on localhost, and you're the only user today. The audit found real plans to host it for teammates: HOSTING.md, SAAS_PLAN.md, server auth finished 10-12, a VPS purchase planned. **Default: keep** the login and fix the password-reset hole, with Users as a Settings tab. Alternative: delete the login, Users, Database and server auth (~1.3k LOC) for a single-user tool.
2. **CI home (R6).** The root repo `KulvinderGosal/QAAutomations` is **public**, and most framework folders aren't committed anywhere. **Recommended:** the existing **private** repo `KulvinderGosal/TestPilot`, which already holds TestPilot and all 8 framework dirs, using a GitHub Actions matrix per framework with secrets in repo secrets. Auth-gated and mobile suites stay on the local runner behind the session gate. Alternative: the public root repo, limited to public no-login suites.
3. **Old launchd smoke monitors.** Retire `com.awesomemotive.qa.smoke-all` and `smoke-auth-ctas` once CI and TestPilot schedules cover the same sites? They run outside TestPilot with no honest-verdict floor; the last report (2026-10-19) was 0/7.
4. **Confirm the removal list** (§3), including features you asked for earlier but never used: Performance (09-21), the lifecycle modules (Sep), SKB Docs (Aug) and the V2a Asana intake (10-12).

## 6. How to implement safely (constraints the verifiers established)

- **Don't edit the live folder in place.** The LaunchAgent `com.testpilot.dev` runs `npm run dev` from `~/QA-Automations/TestPilot`. Every `server/*.ts` edit restarts Vite and kills in-flight runs. A broken intermediate state leaves Vite on old code ("server restart failed"), and after a reboot TestPilot is down and the Sun/Wed monitors don't fire. Git worktrees don't help, because 98% of the files are untracked.
  - **Do:** copy to `~/QA-Automations/TestPilot-next`, work and verify there on another port, then swap it in once everything is green.
- **The copy must not touch live state.**
  - `server/tmStore.ts:33-34` hard-codes the DB path. Add an env override (e.g. `TP_TM_DB`) and point the copy at a DB copy.
  - The scheduler, sessions and runs files are cwd-relative, which is fine in a copy, but **disable the scheduler ticker and canary in the copy**. Otherwise the Sun/Wed monitors double-fire (`TP_SESSION_CANARY=0`, plus a new scheduler-off env).
  - `GET /api/sessions` without `cached=1` spawns real `auth:probe` processes.
- **Landing order:** R1 → R2 → R4 → R5 → (U4, U9, U5) → U3 → (U2 + U11 together; intake's `scrub` is used by the Asana handler) → U1 → U13 → R3 → U14 → U6, U8, U10, U17, U18 → R6 → U7 → R7–R11, R13 → R12. U12 depends on decision 1. U15 is archived and dealt with as part of R6. Reason for the order: U4/U9 import `aiTest`/`getPullRequest`, so they must go before U2/U3. `tm/store.ts` imports `GithubPr` + `defaultFrameworkFor`, so U5 goes before U2/U3. `seed()` uses mock `products`, so R4 goes before U1/U13. The `/` route moves, so R3 goes before U14.
- **Verify after every step:**
  - `npx tsc -p tsconfig.app.json --noEmit`
  - `npx tsc -p tsconfig.node.json --noEmit`
  - `npm run lint`
  - `npm run test:verdict`
  - `npm run test:intake` (until U11 removes intake)
  - `npm run build`
  - Load each surviving screen in the browser with 0 console errors.
  - Before the swap, one real runner run (a public smoke such as `pushengage-site` or `ledgerport-marketing-site`) must return an honest verdict.
- **Archive everything you delete** (untracked = unrecoverable): the root workflows, TestPilot-HostReady (holds a unique SAAS_PLAN.md + scrypt auth), launchd plists, run history, Run Story details, schedules and sessions. The R1 snapshot must include `.testpilot-schedules.json` and `.testpilot-runs.json`.
- **External writes:** none during implementation. No pushes. The CI branch is prepared for the user's review only. The QA Log (localStorage `testpilot.qaLog`) must be exported before U2 deletes its reader.
- **Docs:** CLAUDE.md (54 KB) must be rewritten to match the 5-screen app. Also refresh:
  - `~/QA-Automations/docs/QA-PROCESS.md`
  - the `testpilot-qa` skill (SKILL.md frontmatter "alert Slack", run-product.sh "Reports → run history")
  - `pushengage-app-dashboard/tests/upgrade-engine/README.md:67`
  - memory files: project_qa_autonomy_phase1, project_testpilot_always_on, feedback_playwright_runner_first, project_iam_ios_disp_cluster (uses `/api/asana/*` as a proxy — switch it to the Asana MCP)

---

# Appendix — full plan detail

## A. Removal units

### U1 · Simulated cockpit layer, mock fixtures and the notification bell

**Confidence:** high

**Paths:**
- `src/store/useStore.ts (runTestPlan 853-975; fileIssue/issueDrafts/issueSeq 976-1027; acceptKnownIssue 1028-1043; commentAndMarkReady 1046; mergeTask+merged/deployed 1048-1055; bulkRun 1196-1203; scaffoldTests/generateFromTask 1205-1206 + generateTestsForTask 1590-1637; devRespond/simulateDevFix 1377-1408; runQaPipeline/advanceQaStage 820-851 + seedPipeline/runStage/postPrReport/simulated local postAsanaComment 1639-2002; toggleTestArtifact 729-734; editorTaskId/artifactModal/expandedTests; notifications/notifOpen/issues/repos; initial mock state 519-521)`
- `src/screens/taskDetail/QaPipelineCard.tsx`
- `src/screens/taskDetail/QaStageIcon.tsx`
- `src/screens/taskDetail/OutcomeCard.tsx`
- `src/screens/taskDetail/PrReportCard.tsx`
- `src/screens/taskDetail/AsanaCommentCard.tsx`
- `src/screens/taskDetail/BrowserMatrix.tsx`
- `src/screens/taskDetail/Stepper.tsx`
- `src/screens/taskDetail/PhaseSection.tsx`
- `src/screens/taskDetail/TestRow.tsx`
- `src/screens/taskDetail/helpers.tsx`
- `src/components/modals/SpecEditorModal.tsx`
- `src/components/modals/ArtifactViewerModal.tsx`
- `src/components/ui/DemoBadge.tsx`
- `src/components/layout/notifIcons.tsx`
- `src/components/layout/Header.tsx (bell + notifications dropdown, global 'Search tasks, issues…' input)`
- `src/data/mock.ts (tasks, issues, notifications, repos, devs, tests() helper; the products catalog moves to the server registry first, see refine R4)`
- `src/types.ts (Phase/PHASE_ORDER/TestStatus/TestCase 4-53, QaStageKey…AsanaComment 241-318, Issue/IssueState/AppNotification/Repo 368-410, TaskRun, Task.failIndex/run/qaPipeline/tests/testArtifacts)`

**Why:** These flows fabricate results, which contradicts both the user's rule of never passing on behavioural inference and the V1 verdict floor. One fake path also ends at a REAL write: simulated runTestPlan in 'verify' mode (useStore.ts:931) and the scripted runQaPipeline arc both set task.status='verified', and that status is the only gate for 'Close task' (TaskDetail.tsx:88-92). Close task then runs closeTask → completeAsanaTask PUT completed:true. Several fakes carry no Demo label: 'File issue & assign' invents issue #300+, 'Run QA pipeline' toasts 'Asana task marked complete', 'Generate from task' writes 4 placeholder tests. None of this belongs in a tool for running real tests. All three reviewers agreed.

**Evidence:** Store inventory: ~750 of useStore's 2,002 lines are simulation. Simulated cards are 714 LOC, the two modals 201. 8 of the 11 mock tasks never leave the queue: the 6 origin-'manual' ones can't be replaced by any connector, and Slack has no token. The bell shows 6 mock notifications (4 unread), and n1/n2 open 'Task not found'. Overview 'Bugs cleared' counts mock issue #219. mock.ts is 848 lines, ~85% fixtures, and 25.6 KB of the bundle. Transcripts show no use of these flows.

**Blast radius:** AppShell.tsx (modal mounts). TaskDetail/QaQueue/Overview lose their simulated buttons; those screens are deleted in U2, so land U1 and U2 in the same change or run tsc after each. Mappers in src/lib/asana.ts, github.ts and slack.ts stop emitting tests/testArtifacts/failIndex (they go in U2). tm/store.ts:7 and ProductChip import `products` from mock.ts, so refine R4 must replace the catalog first. CLAUDE.md 'DEMO labels' paragraph.

**Data impact:** None persisted; it is all in-memory task state. localStorage testpilot.qaLog may hold entries created after simulated or mock 'verified' tasks; they leave with U2.

- **Verifier (Dependencies) — safe**
  - src/lib/tone.ts cannot be deleted. It has live importers: BRAND_TONE in Schedule.tsx:15, TestRunner.tsx:5 and Pipelines.tsx, and the Tone type in primitives.tsx:4 and tm/types.ts:8. It imports IssueState and QaStageStatus from @/types, which U1 deletes, plus Ownership, TaskStatus and Priority. So QA_STAGE_TONE, ISSUE_STATE_TONE, OWNERSHIP_TONE, TASK_STATUS_TONE and PRIORITY_TONE must be trimmed in the same change, or tsc fails.
  - AppShell.tsx reads useStore closeNotif and puts it on the content div's onClick (AppShell.tsx:11 and :31). The plan mentions AppShell only for the modal mounts.
  - The useStore State type declares `products: typeof products` (useStore.ts:121, initialised at :523), and the tm/store.ts seed() uses mock `products` (:568). R4 must replace the catalog before mock.ts goes.
  - Orphaned files the plan does not delete: components/icons/AsanaLogo.tsx and SlackLogo.tsx (their importers are all removed), and src/lib/product.ts (its only importer is ProductChip).
  - If U12 is cancelled, Database.tsx:66-68 still reads s.tasks, s.issues and s.savedTests.
  - Also touch: `src/lib/tone.ts (trim, do not delete)`, `src/components/layout/AppShell.tsx (closeNotif onClick)`, `src/store/useStore.ts:121 (State.products type)`, `src/components/icons/AsanaLogo.tsx`, `src/components/icons/SlackLogo.tsx`, `src/lib/product.ts`, `src/screens/Database.tsx (if U12 cancelled)`
- **Verifier (Data & safety) — safe**
  - None for data: all simulated state (tasks, issues, notifications, pipeline stages, test artifacts) lives only in memory in useStore. It removes a fake path that ends at a real write: verified=true → Close task → completeAsanaTask. That is a safety gain.
  - Ordering only: tm/store.ts:7 imports `products` from @/data/mock, so R4 must land first, as the plan says.
  - Also touch: `src/components/layout/AppShell.tsx (modal mounts)`
- **Verifier (Evidence) — safe**
  - No reliance found. Run history (200 entries) has no simulated runs, and memory project_testpilot_asana_routing.md already tells Claude to ignore the mock /queue/task-N fixtures. The only condition is the ordering the plan already gives: R4 must replace the `products` import in src/tm/store.ts:7 and src/store/useStore.ts:9 before mock.ts is deleted.

### U2 · Task/connector cockpit: Overview, QA Queue, Task Detail, QA Log, Integrations, plus the Asana/Slack connectors and GitHub issue routes

**Confidence:** medium

**Paths:**
- `src/screens/Overview.tsx`
- `src/screens/QaQueue.tsx`
- `src/screens/TaskDetail.tsx`
- `src/screens/taskDetail/BugsForPr.tsx`
- `src/screens/taskDetail/QaAuthoringCard.tsx`
- `src/screens/taskDetail/TaskRunnerCard.tsx`
- `src/screens/taskDetail/RightColumn.tsx`
- `src/screens/QaLog.tsx`
- `src/lib/qaLog.ts`
- `src/screens/Integrations.tsx`
- `src/data/stores.ts`
- `src/components/AsanaOriginBadge.tsx`
- `src/components/GithubOriginBadge.tsx`
- `src/components/SlackOriginBadge.tsx`
- `src/lib/asana.ts`
- `src/lib/slack.ts`
- `src/lib/github.ts (keep only fetchLatestCommit; the new CI client is added in R6)`
- `src/lib/taskUi.ts, src/lib/tone.ts, src/components/ui/FilterMenu.tsx, src/components/ProductChip.tsx (delete each if grep finds no remaining importer)`
- `server/asana.ts`
- `server/slack.ts`
- `server/github.ts (keep latestCommit; delete listMyIssues/listRepoIssues/closeIssue/commentOnRepoIssue/getPullRequest/listPrs)`
- `server/api.ts (asana, slack and github issue/pr/comment/close handlers; drop those 4 routes from the nonce write list)`
- `src/store/useStore.ts (tasks, devs, inboxFilter/selected, claimTask/releaseTask, closeTask, testGithubIssue/verifyGithubFix/finishGithubVerify/pendingGithubVerify, qaLog, asana*/github*/slack* state, loadAsana/loadGithub/loadSlack, autoAuthor queue)`
- `src/App.tsx (routes /overview, /queue, /queue/:taskId, /qa-log, /integrations; the connector loads on sign-in)`
- `vite.config.ts:25 (hard-coded Slack alert link)`

**Why:** This stack is a task inbox, not 'pick a product → run its tests → honest result → schedule/CI'. In practice the QA loop moved off it in July. Intake is a gid or PR pasted into chat plus the Asana MCP. Findings go through report-qa-finding and gh. Verify→close is gh plus the Asana MCP. The stack also can't serve that loop: the Asana list is capped at 100 items (server/asana.ts:158), 85 of which are case subtasks; GitHub is pinned to one of ~8 repos (GITHUB_REPO, github.ts:188-198); Slack never had a token. Its one real write path, Verify fix, runs a whole-product smoke instead of the issue's repro. It also resolves lp-shopify to ledgerport-saas-automation (src/lib/qaPlanner.ts:43), so an honest PASS of the wrong product could close a LedgerPort Shopify issue. Deleting the stack removes that bug and the fake-'verified' Asana close gate together. Reviewers disagreed: workflow-fit wanted to rebuild it as a ledger with write-back, risk-safety wanted to keep the proxies. The user's direction ('stupid simple', run and track automated tests) decides it: delete.

**Evidence:** Transcripts: /queue last hit 2026-07-14, /overview 0 navigations ever, /qa-log 07-13, /integrations 07-14. /api/github/comment|close-issue last called 07-13, /repo-issues 07-15. Run history: 0 of 200 runs carry taskRef.taskId or a PR, and 0 Verify-fix smoke runs. The Asana proxy's last curl write was 2026-10-06; in October the Asana MCP did add_comment ×18 and update_tasks ×15. Over Aug/Sep/Oct, gh did issue close 4/20/7 and comment 3/35/1. QA Log duplicates Reports §1 (same qaLog slice). Size ≈4.8k LOC: Overview 690, QaQueue 512, TaskDetail 246, real task cards 811, QaLog 142, Integrations 353, server asana/slack/github ≈990, client libs ≈590, store slices ≈400.

**Blast radius:** Sidebar: OPS_NAV, queue badge, footer Integrations. Header: CRUMBS and the global search (only QaQueue read `query`). server/scheduler.ts imports postMessage from ./slack (lines 15, 125, 263); switch to the existing macNotify (scheduler.ts:376). /api/schedule/alert-status and /api/schedule/test-alert must keep answering because the testpilot-qa SKILL.md:128-136 calls them; have them report channel 'macos'. src/lib/session.ts and GET /api/session/nonce stay, since POST /api/sessions/:persona/probe still needs a nonce. CLAUDE.md sections to drop: QA Queue, GitHub Verify-fix, Bugs for this PR, Close→Asana, Asana comment write-back, QA Log, Test stores, Slack. Memory files to update: project_testpilot_asana_routing.md (use the Asana MCP) and feedback_qa_lifecycle.md (write-back = gh + Asana MCP). .env.example: drop ASANA_*, SLACK_*, GITHUB_REPO; keep GITHUB_TOKEN (latest-commit + CI status).

**Data impact:** No server data. localStorage testpilot.qaLog is per browser: export it once from Settings→Data (or DevTools) before deploying, or leave it orphaned. Asana and GitHub stay the source of truth for closed work. The test-store bookmarks already exist in ~/QA-Automations/config/fixtures.json.

- **Verifier (Dependencies) — UNSAFE**
  - The plan does not give the landing order:
  - - Trimming src/lib/github.ts to fetchLatestCommit breaks src/tm/store.ts:12 (`import type { GithubPr }`) and TestPlans.tsx:6 (fetchPr, listPrs, parsePrUrl) unless U5 lands first.
  - - Deleting server getPullRequest (github.ts:352) breaks server/skbDocs.ts:20 unless U4 lands first.
  - - asanaHandler's scrubTask calls intake.scrub (U11), so U2 and U11 must land together.
  - - The trimmed src/lib/github.ts must also drop its import of inferProductId from the deleted lib/asana.ts (github.ts:5).
  - Kept code still references retired routes:
  - - SessionBadge.tsx imports canAccess, gates on canAccess('/runner') (:17) and navigates to '/runner' (:45).
  - - RunStory.tsx:197 links to '/reports'.
  - vite.config.ts:25 is not a Slack link. It is the appUrl that scheduler.ts uses to build `${appUrl}/runs/<id>` alert links, so it must stay for macNotify and alert links, along with the /runs/:id route.
  - The scheduler change needs more than an import swap:
  - - server/scheduler.ts alertConfig/alertStatus key `ready` on slackToken (:105-116).
  - - startSchedulerWithAlerts (api.ts) passes slackToken and slackChannel.
  - - testpilot-qa SKILL.md:126-131 tells Claude it CANNOT send when ready:false.
  - - The SKILL.md frontmatter says 'alert Slack on failure'.
  - The Asana proxy is part of a documented Claude workflow. Memory project_iam_ios_disp_cluster.md documents `proxy = TestPilot localhost:5173/api/asana (GET /tasks; POST /comment; POST /complete-task)`, and project_onboarding_revamp_1015.md:93 records a completion via /api/asana/complete-task. Removing the routes breaks that recipe; the replacement is the attached Asana MCP. The plan's memory list covers only project_testpilot_asana_routing.md and feedback_qa_lifecycle.md.
  - Other docs describe the removed flow: docs/QA-PROCESS.md (QA Queue intake, QA Log record-every-close, /runner) and pushengage-app-dashboard/tests/upgrade-engine/README.md:67 (/runner).
  - Also touch: `src/components/layout/SessionBadge.tsx`, `src/screens/RunStory.tsx:197`, `src/lib/github.ts:5 (inferProductId import)`, `server/scheduler.ts:105-131,202-266 (alertConfig/alertStatus/sendTestAlert)`, `server/api.ts startSchedulerWithAlerts/configureAlerts`, `/Users/kulvindersingh/.claude/skills/testpilot-qa/SKILL.md (frontmatter + Slack alerting section)`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_iam_ios_disp_cluster.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_onboarding_revamp_1015.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_iam_android_qa.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_iam_android_pr34_retest_0c26c6f.md`, `/Users/kulvindersingh/QA-Automations/docs/QA-PROCESS.md`, `/Users/kulvindersingh/QA-Automations/pushengage-app-dashboard/tests/upgrade-engine/README.md`
- **Verifier (Data & safety) — safe**
  - The real external writes go away: Asana complete-task and comment, GitHub close-issue and comment. Nonces are checked per handler (hasValidNonce, server/api.ts:235), so the sessions-probe nonce is unaffected once the asana/github handlers are deleted. G3 stays intact.
  - localStorage testpilot.qaLog is orphaned, not deleted. The plan's 'export from Settings→Data' cannot happen in this change because Settings→Data only arrives in R10. Either export through DevTools before U2, or keep a one-shot export button until R10.
  - server/scheduler.ts alert code uses Slack in three places: alertConfig at 105-127, the readiness check at 208, and postMessage at 263. GET /api/schedule/alert-status must keep returning `ready` as a boolean, because SKILL.md:128-136 branches on it. Update the skill's Slack wording in the same change, or it will claim alerts are 'sent to Slack'.
  - Also touch: `server/scheduler.ts:105-127,208,263 (alert config → macNotify)`, `/Users/kulvindersingh/.claude/skills/testpilot-qa/SKILL.md:128-136`
- **Verifier (Evidence) — UNSAFE**
  - vite.config.ts:25 is listed as a removal path ('hard-coded Slack alert link'), but that line is `startSchedulerWithAlerts(env, 'http://localhost:5173')`. Per server/api.ts:1295-1299 it runs configureAlerts, configureCanary and startScheduler, so it starts both the 30 s scheduler ticker and the I1 session canary. Deleting it silently stops all 4 Sun/Wed monitors and the canary. Only the Slack fields inside configureAlerts should change.
  - server/slack.ts also holds postMessage, which is the user-requested alert channel for the scheduled monitors. July human prompts in session 5daa1727 match 'schedul…slack' and 'slack…alert'. The channel is documented in feedback_qa_lifecycle.md ('alert Slack on failure') and in the testpilot-qa SKILL.md description and 'Slack alerting' section. Switching to macOS-only notifications changes a stated user preference. Either keep postMessage (~40 LOC, moved into scheduler.ts) and SLACK_BOT_TOKEN/SLACK_QA_CHANNEL and delete only listQaMessages/getTeam and the queue sync, or add it to askUser.
  - Claude still relied on the Asana proxy recently. Assistant Bash calls hit localhost:5173/api/asana/comment in Aug, Sep and Oct (session 5daa1727) and /api/asana/complete-task in Sep. The Asana MCP add_comment (@mention via data-asana-gid) and update_tasks(completed) replace it, but the MCP has no attachment upload. The screenshot recipe in project_testpilot_asana_routing.md uses a direct curl with TestPilot/.env ASANA_ACCESS_TOKEN. The memory rewrite must keep that recipe, and the token must stay in .env even though .env.example drops ASANA_*.
  - dataImpact names an 'export from Settings→Data' step for localStorage testpilot.qaLog, but R10's Data tab only covers TM backups. No unit implements a qaLog/savedTests export, even though feedback_qa_lifecycle.md calls the QA Log 'the durable record'.
  - Also touch: `/Users/kulvindersingh/QA-Automations/TestPilot/vite.config.ts (keep the startSchedulerWithAlerts call)`, `/Users/kulvindersingh/QA-Automations/TestPilot/server/scheduler.ts (postMessage import at :15, :125, :263; configureAlerts)`, `/Users/kulvindersingh/.claude/skills/testpilot-qa/SKILL.md (description 'alert Slack on failure' + Slack alerting section lines 125-131)`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_testpilot_asana_routing.md (keep the attachment curl recipe)`, `src/screens/Settings.tsx Data tab (qaLog/savedTests one-time export)`

### U3 · In-app AI layer (QA Copilot, QA authoring/auto-author/Excel, Hand to AI, coverage gap, PR→plan enrich, Ask AI/Generate spec)

**Confidence:** high

**Paths:**
- `server/aiTest.ts`
- `server/qaPlanner.ts`
- `server/api.ts (/api/ai/status|interpret|generate|save, /api/qa/plan|scenarios|cases|coverage|export|record; the hard-coded model id at :803)`
- `src/lib/ai.ts`
- `src/lib/qaPlanner.ts (incl. PRODUCT_FRAMEWORK/defaultFrameworkFor, replaced by the registry in R4)`
- `src/store/useStore.ts (aiReady/aiUnfunded/autoAuthor/authorQaPlan/exportQaRecord/ensureAiReady/scenariosToTestCases/AREA_TO_PHASE; 194-200, 736-818, 1414-1588)`
- `src/tm/store.ts (generateCases/aiBusy/aiError 1576-1632)`
- `src/screens/tm/TestCases.tsx (CopilotModal + 'Create with QA Copilot')`
- `package.json (@anthropic-ai/sdk, exceljs)`

**Why:** Every entry point returns 402 because the key is unfunded and there is no ant profile on the host. /api/ai/status reports ready:true only because a key exists. Nothing has ever been produced. Auto-author defaults ON, so each reload re-queues ~100 Asana tasks into failing calls; on a funded key it would write specs into framework repos without a confirm. Claude Code already does this work in chat, and AI authoring is outside 'run and track automated tests'.

**Evidence:** No ai-generated/ folder in any framework. 0 .xlsx in ~/QA-Automations/testpilot-qa-records. 0 Copilot cases (review:'pending' = 0 of 3,060). /api/qa/* last called 2026-07-15; /api/ai/interpret|generate last 07-13/14; /api/ai/save never. ≈1.6k LOC across 7 UI entry points.

**Blast radius:** Screens that lose AI buttons are all deleted elsewhere: QaQueue Hand to AI (U2), Requirements Analyze coverage (U5), TestPlans PR enrichment (U5), Manual Test Ask AI (U8), Reports flaky Diagnose (U9), SKB compose (U4). Also update .env.example ANTHROPIC_*, the CLAUDE.md sections 'AI actions are credit-gated', 'Ask AI' and 'AI QA authoring', and memory project_testpilot_ai_credits.md.

**Data impact:** None; no AI artefact exists. The hand-made docs in testpilot-qa-records are untouched.

- **Verifier (Dependencies) — UNSAFE**
  - U3 breaks the build unless it lands last, after or with U2, U4, U5, U8 and U9:
  - - On the server, flaky.ts:16 (U9) and skbDocs.ts:19 (U4) import ./aiTest.
  - - On the client, tm/store.ts:9 imports aiPlanTask, aiScenarios and defaultFrameworkFor from lib/qaPlanner.
  - - tm/store.ts:1887 (createPlanFromPr, U5) calls defaultFrameworkFor.
  - - TaskRunnerCard and QaAuthoringCard (U2) and Requirements (U5) also import qaPlanner.
  - - ManualTest (U8) and Integrations (U2) import lib/ai.
  - tm/store.ts helpers left dangling: mapPriority (:772), scenarioToSteps (:778) and the `Priority, TestScenario` import from @/types (:13). These exist only for Copilot; remove them, or noUnusedLocals fails.
  - Remove @anthropic-ai/sdk and exceljs only once aiTest, qaPlanner, skbDocs and flaky are all gone.
  - The '@playwright/test' hits in aiTest.ts, qaPlanner.ts and SpecEditorModal.tsx are generated-code strings, not imports. Do not read them as importers.
  - Also touch: `src/tm/store.ts:13,772-781 (mapPriority/scenarioToSteps/types)`, `server/flaky.ts (ordering with U9)`, `server/skbDocs.ts (ordering with U4)`, `server/api.ts API_ROUTE_ROLES /api/ai,/api/qa (if U12 cancelled)`
- **Verifier (Data & safety) — safe**
  - Verified: no ai-generated/ folder exists in any framework (maxdepth 4), and testpilot-qa-records holds only hand-made docs. No data is lost.
- **Verifier (Evidence) — safe**
  - No usage after 07-27. The last human mention is the July 'Create with QA Copilot' 402 report in project_testpilot_ai_credits.md. 0 xlsx files, 0 ai-generated/ folders, no assistant calls to /api/ai or /api/qa in Aug-Oct. @anthropic-ai/sdk and exceljs are imported only by server/aiTest.ts and server/qaPlanner.ts, so removing the packages is clean once U4 and U9 also remove their aiTest imports (server/skbDocs.ts:19, server/flaky.ts:16).

### U4 · SKB Docs

**Confidence:** high

**Paths:**
- `src/screens/SkbDocs.tsx`
- `src/lib/skbDocs.ts`
- `server/skbDocs.ts`
- `server/api.ts (/api/skb/status|index|analyze|compose|create)`
- `.testpilot-skb-index.json`
- `src/components/layout/Sidebar.tsx (entry)`
- `src/App.tsx (/skb-docs)`

**Why:** It is broken end to end and outside scope. skbReady:false (SKB_WP_* empty), XML-RPC returns 403, compose needs the unfunded key, and the index holds 0 articles. /api/skb/create would make a real WP draft in one click with no confirm. It renders previewHtml via dangerouslySetInnerHTML (SkbDocs.tsx:572) and is undocumented in CLAUDE.md.

**Evidence:** The 12 /api/skb calls and 6 navigations all fall in the 08-13..17 build window. The index was cached 2026-08-26 with articles:[]. The one real KB draft (post 648) was pasted by hand. 1,344 LOC.

**Blast radius:** Sidebar, App route, Header CRUMBS, mountAll order, SKB_WP_* in .env.example, memory project_testpilot_skb_docs.md. github.getPullRequest goes with U2.

**Data impact:** Only the empty index cache. The skb-docs drafts in testpilot-qa-records stay.

- **Verifier (Dependencies) — safe**
  - Must land before U2 (getPullRequest) and U3 (aiTest), since skbDocs.ts imports both.
  - mountAll passes env.GITHUB_REPO and SKB_WP_* into skbHandler (api.ts:1281-1286). Remove that call together with the handler.
  - Header CRUMBS has no /skb-docs entry, so there is nothing to remove there. API_ROUTE_ROLES has /api/skb and /api/skb/create (only relevant if U12 is cancelled).
  - Also touch: `server/api.ts:1281-1286 (mountAll skbHandler call)`, `server/api.ts API_ROUTE_ROLES /api/skb,/api/skb/create (if U12 cancelled)`, `src/lib/users.ts ROUTE_ROLES '/skb-docs' (if U12 cancelled)`
- **Verifier (Data & safety) — safe**
  - Verified: .testpilot-skb-index.json is 418 bytes with articles:[]. Removing it also removes a one-click real WP draft create (/api/skb/create).
- **Verifier (Evidence) — safe**
  - The user asked for this in August (project_testpilot_skb_docs.md: 'Workflow the user wants', one-click create). Human prompts mention 'skb' only in Aug, with nothing from TestPilot sessions after that. It falls outside the new 'automating products' scope. Tell the user explicitly in the summary that a feature they asked for is being removed. The real draft (post 648) and testpilot-qa-records/skb-docs stay.

### U5 · TestCollab modules: Test Plans, Test Runs, Requirements, Traceability, Releases, Defects, Risks, plus the Dashboard quality-metrics row

**Confidence:** high

**Paths:**
- `src/screens/tm/TestPlans.tsx (incl. the RunAutomation runner copy 219-381)`
- `src/screens/tm/TestRuns.tsx`
- `src/screens/tm/Requirements.tsx`
- `src/screens/tm/Traceability.tsx`
- `src/screens/tm/Releases.tsx`
- `src/screens/tm/Defects.tsx`
- `src/screens/tm/Risks.tsx`
- `src/tm/store.ts (createPlan/createPlanFromPr/updatePlan/deletePlan/recordExecution, requirements/risks/releases/defects CRUD 1801-2048)`
- `src/tm/types.ts (TmPlan, TmExecution, TmRequirement, TmRisk+riskScore/riskBand, TmRelease gateCriteria/signOff, TmDefect, their TM_* label/tone maps, TmCase.requirementIds)`
- `src/screens/tm/TestCases.tsx (add-to-plan/createPlan action, requirementIds editor field)`
- `src/App.tsx (7 routes incl. hidden /tests/risks)`
- `src/components/layout/Sidebar.tsx (TM_NAV entries incl. the commented Risks line)`
- `src/components/layout/Header.tsx (CRUMBS)`
- `src/lib/users.ts (ROUTE_ROLES entries)`

**Why:** Not one record has ever been created in any of these modules. Plans are written with test-plan-generator or claude.ai artifacts, bugs are filed on GitHub, and the release decision is made in chat. The quality tiles are permanently '—' or 0, which misleads. TestPlans carries a fourth copy of the run picker. The modules have nothing to do with running the product suites.

**Evidence:** plans, executions, requirements, risks, releases and defects are all 0, and so are their seq counters, in GET /api/tm/state and all 19 DB backups. The only navigations happened at build time. ≈2,610 screen LOC + ≈330 store LOC + ≈150 type lines. The 2026-09-21 'remove unnecessary items' request ended up un-hiding Traceability/Defects and adding the metrics, all of which stayed empty.

**Blast radius:** normalize/lean in tm/store.ts must tolerate or strip these keys so the existing backups still restore. TestRuns '?plan=' link from TestPlans. CLAUDE.md TMS and '2026-09 QA-process pass' paragraphs.

**Data impact:** None; every collection is an empty array, including in the backups.

- **Verifier (Dependencies) — safe**
  - src/tm/store.ts holds more than the CRUD ranges listed: the Persisted type (:68-81), emptyPersisted (:888), persist() (:904-920), normalizeAndBackfill (:668-681), and seed() returning plans/executions/requirements/risks/releases/defects plus their seq keys (:627-634). Keep them tolerant of old keys so the 19 backups still restore.
  - createPlanFromPr in tm/store needs `GithubPr` from lib/github, `products` and defaultFrameworkFor. It must go in this unit, before U2 and U3.
  - TestCases.tsx:209-214 (createPlanFromSelection) navigates to /tests/plans?focus=. Its buttons are at :256 and :413.
  - The plan says TestCases has a requirementIds editor field. It does not: requirementIds appears only in tm/types.ts:89. Harmless.
  - TestPlans.tsx and Releases.tsx read useStore users (relevant to U12).
  - Also touch: `src/tm/store.ts:68-81,627-634,668-681,888-920 (Persisted/seed/normalize/persist keys)`, `src/screens/tm/TestCases.tsx:80,209-214,256,413`
- **Verifier (Data & safety) — safe**
  - Verified against the live state and all 19 DB backups. plans, executions, requirements, risks, releases, defects, perfRuns and deviceRuns are 0 everywhere. 0 cases carry externalRef. 0 cases have non-empty requirementIds or comments.
  - persist() (store.ts:907-926) builds an explicit field list. Once the keys leave Persisted, the next save drops them from the blob; that is harmless because they are empty. normalizeAndBackfill already ignores unknown top-level keys, and backups 1-3 already lack perfRuns, so old backups restore fine.
  - The case editor must keep `caseType`, which 100 curated case-suite-* cases carry and the plan does not remove. Removing the requirementIds field must not rebuild case objects from form fields alone.
- **Verifier (Evidence) — safe**
  - All collections are confirmed empty in GET /api/tm/state: plans, executions, requirements, risks, releases and defects are 0, and so are their seq counters. A Sep human prompt in 5daa1727 matches 'lifecycle'; that was the 09-21 request to align with the QA lifecycle, which un-hid Traceability/Defects. It was a user request, but nothing was ever recorded and the newer 'stupid simple' direction supersedes it. normalize() must still accept these keys so the 19 existing backups restore.

### U6 · Performance load tester

**Confidence:** medium

**Paths:**
- `src/screens/tm/Performance.tsx`
- `src/lib/perf.ts`
- `server/perf.ts`
- `server/api.ts (perfHandler, POST /api/perf/run)`
- `src/tm/store.ts (perfRuns/startPerfRun/deletePerfRun 2050-2115)`
- `src/tm/types.ts (TmPerfRun/TmPerfTxn)`

**Why:** It has never been used and it is a footgun. It sends real load (up to 50 VUs × 120 s × 10 targets) to any URL, production included, without the qa-core assertAllowedTarget guard (server/perf.ts:76). Load testing is outside the user's stated scope. The user did request it on 09-21, but the user's newer direction ('stupid simple') overrides that.

**Evidence:** perfRuns=0 and seq.perf=0 in the state and backups 4-19. The only /api/perf/run calls were the 2 build-time calls on 09-21/22. ≈640 LOC. Missing from CRUMBS.

**Blast radius:** Sidebar, App route, mountAll order, the CLAUDE.md Performance paragraph and the 'Not guarded yet: /api/perf/run' note.

**Data impact:** None.

- **Verifier (Dependencies) — safe**
  - tm/store.ts:11 imports runPerf and PerfRunInput from lib/perf. It also has Persisted.perfRuns, seq.perf (:627-634, :679) and the emptyPersisted/persist keys.
  - API_ROUTE_ROLES has /api/perf (only relevant if U12 is cancelled).
  - Memory project_testpilot_tms_rebuild.md:85 documents /api/perf.
  - Also touch: `src/tm/store.ts:11 (lib/perf import) + Persisted/seq perf keys`, `server/api.ts API_ROUTE_ROLES /api/perf (if U12 cancelled)`
- **Verifier (Data & safety) — safe**
  - Safety gain: it removes the only unguarded outbound-load path (no assertAllowedTarget). perfRuns=0 in the live state and in every backup.
- **Verifier (Evidence) — safe**
  - The user asked for this explicitly: a Sep human prompt in 5daa1727 matches 'maxoperf'. That is a request about a month old, not reliance: perfRuns=0, seq.perf=0, and no assistant /api/perf calls after build time. Removal is within 'refine the rest', but the summary should name it as a removed requested feature.

### U7 · Local Pipelines (replaced by the GitHub Actions CI view, R6)

**Confidence:** high

**Paths:**
- `src/screens/Pipelines.tsx`
- `src/lib/pipelines.ts`
- `server/pipeline.ts`
- `server/api.ts (pipeline handler + stagesFor import at :55/:770)`

**Why:** No pipeline has ever run. It keeps state in an in-memory Map (pipeline.ts:39) that is lost on every Vite restart (149 restarts logged), swallows start errors (pipeline.ts:103), and would give ledgerport-saas-automation only a Report stage. It is replaced, not merged: CI/CD becomes one GitHub Actions matrix (R6), and Schedules & CI shows its per-product status. Local multi-stage runs remain possible as a scheduled npm script.

**Evidence:** 0 of 200 runs carry a 'Pipeline N · <stage>' taskRef and 0 test:smoke/test:regression command runs; /api/pipeline was last called 2026-07-18 and GET /api/pipeline/list returns []. 422 LOC. CLAUDE.md still calls it 'the primary run-the-tests surface'.

**Blast radius:** Sidebar, App route, ROUTE_ROLES, the CLAUDE.md Pipelines section. The runner's command mode stays (the Scheduler uses it), and so do the frameworks' test:smoke/test:regression scripts (CI uses them).

**Data impact:** None (in-memory and empty).

- **Verifier (Dependencies) — safe**
  - Only server/api.ts imports pipeline.ts (stagesFor at :55 and :770). Nothing in the scheduler, runner or skills calls /api/pipeline, so the removal is clean.
  - vite.config.ts:8-13 has a comment listing 'pipelines'. API_ROUTE_ROLES has /api/pipeline (only relevant if U12 is cancelled).
  - Also touch: `server/api.ts API_ROUTE_ROLES /api/pipeline (if U12 cancelled)`, `src/lib/users.ts ROUTE_ROLES '/pipelines' (if U12 cancelled)`
- **Verifier (Data & safety) — safe**
  - In-memory Map only; no data. The only importer is server/api.ts:58.
- **Verifier (Evidence) — UNSAFE**
  - The user's latest message explicitly says 'keep in mind the CI/CD pipeline'. In code, Pipelines is TestPilot's only CI/CD surface: src/lib/pipelines.ts:1 calls it 'CI/CD pipelines', and the July/Aug 'ci/cd' human prompts produced it.
  - The replacement R6 is gated on askUser #2, committing the frameworks plus qa-core, a secret scan and the user's F0 step (make repos private). Its phase 1 covers only 3 public legs. By R6's own design, the auth-gated suites (app-dashboard, both Shopify apps, LP SaaS staging) and mobile never run in GitHub CI.
  - Deleting Pipelines in the same pass therefore leaves TestPilot with no CI/CD at all for an open-ended period, and no ordered stop-on-fail orchestration for the 7 local-only surfaces. That contradicts the user's stated scope. Usage really is 0 (no 'Pipeline N' taskRef; /api/pipeline last hit 07-18), so the objection is to sequencing, not to removal.
  - Fix options: land U7 only after the R6 workflow is merged and /api/ci/status returns real runs; or fold stagesFor and the 3 s stage watcher from server/pipeline.ts (177 LOC) into Schedules & CI, as a 'stages' option on a schedule or run-now for local suites.
  - Also touch: `/Users/kulvindersingh/QA-Automations/TestPilot/server/pipeline.ts (stagesFor reuse in Schedules & CI)`

### U8 · Manual Test ad-hoc runner (page smoke, API request, saved targets)

**Confidence:** medium

**Paths:**
- `src/screens/ManualTest.tsx`
- `adhoc/smoke.spec.ts`
- `adhoc/api.spec.ts`
- `adhoc/adhoc.config.ts`
- `server/runner.ts (startAdhocRun, adhocTargetChecks/assertAdhocTargets, ADHOC_BIN ~1418, ADHOC_* env branch, POST /api/runner/adhoc)`
- `src/store/useStore.ts (savedTests/saveManualTest/deleteManualTest/startAdhocTest/runnerAdhocReady 543-559, 624-642)`
- `package.json (TestPilot's own @playwright/test devDep, only if grep finds no other importer)`

**Why:** It tests arbitrary URLs, not the product suites, and it is unused: page checks are done in Claude-in-Chrome and API oracles with curl. It is also the only path where TestPilot handles run-only credentials (ADHOC_* env), so removing it shrinks the credential surface.

**Evidence:** 0 runs with mode 'adhoc' in the 200-run history (08-07..10-18); /manual last opened 07-14; /api/runner/adhoc called twice, both on 07-11. ≈1,030 LOC.

**Blast radius:** runner.ts is load-bearing, so edit it surgically: keep the auto-retry exclusions and the verdict path intact, and run test:verdict + test:contract afterwards. The qa-core target guard stays in packages/qa-core for the frameworks. CLAUDE.md Manual Test section and the G3 'Ad-hoc target guard' paragraph.

**Data impact:** localStorage testpilot.savedTests (URLs/env only, passwords never saved). Optional one-time export.

- **Verifier (Dependencies) — UNSAFE**
  - Removing TestPilot's own @playwright/test devDep breaks packages/qa-core, and the plan's TestPilot-only grep would not find these references:
  - - packages/qa-core/tsconfig.json maps paths '@playwright/test' to '../../TestPilot/node_modules/@playwright/test' and typeRoots to '../../TestPilot/node_modules/@types'.
  - - packages/qa-core/selftest/types.selftest.ts:6 imports a type from '@playwright/test'.
  - - So qa-core `npm run typecheck` and `npm run check` would break. Keep this devDep.
  - GET /api/runner/frameworks returns `adhoc: adhocHealth()` (api.ts:533), and the client types it (src/lib/runner.ts:214) and reads it (useStore.ts:564 runnerAdhocReady). The response shape changes, so the R2 contract test must not assert it. The skill only checks that the route is reachable, so it stays safe.
  - server/runner.ts:21 imports checkTarget and assertAllowedTarget. Their only users are assertAdhocTargets (:1460-1470), so the import must go too, or noUnusedLocals fails.
  - src/lib/runner.ts still has AdhocBody, SavedTest, readSavedTests, writeSavedTests and startAdhocRun (:121-221). RunPanel.tsx:63-65 and useStore describeRun (:384) have adhoc label branches. These are harmless but dead.
  - Keep the RunStory 'Ad-hoc page screenshot' block (RunStory.tsx:262-270): iOS device runs reuse run.screenshot (runner.ts:1178-1185).
  - If U12 is cancelled, Database.tsx:68 reads s.savedTests.
  - Also touch: `/Users/kulvindersingh/QA-Automations/packages/qa-core/tsconfig.json`, `/Users/kulvindersingh/QA-Automations/packages/qa-core/selftest/types.selftest.ts`, `server/api.ts:533 (adhoc field in /api/runner/frameworks)`, `server/runner.ts:21 (target-guard import)`, `src/lib/runner.ts:121-221 (AdhocBody/SavedTest/startAdhocRun/FrameworksResponse.adhoc)`, `src/screens/runner/RunPanel.tsx:63-65`, `src/store/useStore.ts:384,564`
- **Verifier (Data & safety) — safe**
  - mode 'adhoc' is also referenced by the label function (runner.ts:753) and the retrySafe exclusion (runner.ts:1716). Remove them together and re-run test:verdict.
  - After U6 and U8 land, TestPilot has no path that takes a user-supplied URL. Command mode only runs scripts declared in package.json (runner.ts:1034-1039, hasOwnProperty check). So losing the target guard in TestPilot leaves no gap.
  - localStorage testpilot.savedTests is orphaned (URLs only; passwords were never saved).
  - Also touch: `src/lib/runner.ts (adhoc client + types)`
- **Verifier (Evidence) — safe**
  - No reliance. 0 adhoc runs in history, no assistant /api/runner/adhoc calls in Aug-Oct, and the only '/manual' human mention is from July. The October 'manual test' hits are 'manual testing' (feedback_ui_first_manual_testing.md), not this screen. TestPilot's @playwright/test 1.61.0 devDep is used only by adhoc/*.spec.ts. reporters/story-reporter.cjs is loaded by each framework's own Playwright, so dropping the devDep is safe after a grep.

### U9 · Reports extras: tagged smoke-report builder, on-disk smoke-report index/viewer, Verified & closed, Flaky tests (list/Diagnose/Re-run 5×)

**Confidence:** medium

**Paths:**
- `src/screens/Reports.tsx (sections Verified & closed, report builder ~:131, smoke index + iframe viewer, Flaky; the run-history table moves to the new Runs screen)`
- `server/reports.ts (listSmokeReports/readSmokeReport; keep the history read)`
- `server/api.ts (/api/reports/smoke, /api/reports/smoke/file, /api/flaky/list, /api/flaky/diagnose)`
- `server/flaky.ts`
- `server/flakyPitfalls.ts`
- `src/lib/flaky.ts (incl. rerunToConfirm)`
- `src/lib/reports.ts (keep the history fetch)`

**Why:** Only run history is needed: run-product.sh falls back to /api/reports/history, and Run Story holds the evidence. The builder ran twice, both on 08-13, and the newest smoke report is from that day. Flaky has no usable data and parses 4.2 MB synchronously on each 5 s poll. Diagnose returns 402. CI artifacts (R6) and Run Story replace the HTML report viewer.

**Evidence:** /reports last navigated 07-27; /api/flaky called once (07-27). Of the 60 detail files, 29 are command-mode with 0 tests, the usable ones hold 30 tests, and the biggest is the sleep-poisoned 10-12 run. ≈800 LOC.

**Blast radius:** GET /api/reports/history must keep its shape (contract test, R2). The framework-side reporters/smoke-report.js and test:smoke:report scripts stay in the framework repos. CLAUDE.md Reports + Flaky sections.

**Data impact:** <framework>/smoke-reports/*.html stay on disk.

- **Verifier (Dependencies) — safe**
  - Must land before or with U3, because server/flaky.ts:16 imports ./aiTest.
  - Reports.tsx reads useStore tasks and qaLog (U2) and imports Task from @/types, so it must be rewritten as Runs rather than trimmed.
  - FilterMenu.tsx is the only consumer of @radix-ui/react-popover, which the KEEP list says to keep. Either keep FilterMenu for the Runs filters, or drop popover too.
  - server/reports.ts holds only listSmokeReports and readSmokeReport. The history route lives in reportsHandler via runner.listRunHistory, which is what run-product.sh's fallback needs. Keep the /api/reports/history path and its {history:[…]} shape.
  - RunStory.tsx:197 links to '/reports'. The run-product.sh timeout message says 'check Reports → run history later'.
  - Also touch: `src/screens/RunStory.tsx:197`, `/Users/kulvindersingh/.claude/skills/testpilot-qa/scripts/run-product.sh (timeout message)`, `src/components/ui/FilterMenu.tsx / package.json @radix-ui/react-popover (decide together)`
- **Verifier (Data & safety) — safe**
  - Shrinks the file-read surface (path-guarded smoke/file reader). <framework>/smoke-reports and the .testpilot-detail-*.json files stay on disk.
- **Verifier (Evidence) — safe**
  - feedback_playwright_runner_first.md (07-28) tells Claude to 'run the flaky Diagnose + Re-run 5×' when a spec is stuck. Actual use: one /api/flaky call (07-27) and no assistant calls in Aug-Oct, so this is not reliance. The memory must still be rewritten, and R12 doesn't list it. Re-run N× can be done as run-product.sh spec-mode loops.
  - In October Claude used /api/reports/history and /api/runner/detail (session 1d09ab13), both kept, and never /api/reports/smoke.
  - Also touch: `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/feedback_playwright_runner_first.md`

### U10 · Device-run report store (/api/devrun/*) and the never-read useTm.deviceRuns slice

**Confidence:** medium

**Paths:**
- `server/deviceReports.ts`
- `src/lib/deviceReports.ts`
- `server/api.ts (devrun handler, 48 MB body limit)`
- `src/tm/store.ts (recordDeviceRun, deviceRuns written at :1215)`
- `src/screens/tm/TestCases.tsx (DeviceRunReports modal ~:1403)`

**Why:** It is a second evidence store next to the run record and Run Story, and it was used once. The maestro/ios run modes and runCaseOnDevice(s) stay; only this parallel store goes. Device evidence should live on the run (refine R8).

**Evidence:** 4 /api/devrun calls and 5 report files, all dated 2026-08-14; deviceRuns=0 in the DB. ≈255 LOC.

**Blast radius:** Before deleting, R8 makes the ios mode copy evidence/run-<event>.png into the run's detail record so Run Story shows it.

**Data impact:** The 5 JSON files in ~/QA-Automations/testpilot-device-reports stay on disk as an archive.

- **Verifier (Dependencies) — safe**
  - Other tm/store.ts touch-points: lean() maps deviceRuns (:710-720), plus Persisted.deviceRuns, emptyPersisted, persist and normalize. The recordDeviceRun callers inside runCaseOnDevice and runCasesOnDevice also go, and the saveDeviceReport import (:14).
  - TestCases.tsx:43 imports listDeviceReports and fetchDeviceReport. Its 'Run reports' button and reportsOpen state (:601) go too.
  - The R8(6) precondition is largely met already: the ios mode reads evidence/run-<event>.png into run.screenshot (runner.ts:1178-1185), the detail record stores it (runner.ts:943), and RunStory renders it (:263).
  - Memory project_iam_android_qa.md (Update 2026-08-13b) documents /api/devrun and the device-reports store.
  - Also touch: `src/tm/store.ts:14,710-720 + Persisted/persist deviceRuns`, `src/screens/tm/TestCases.tsx:43,601`, `server/api.ts API_ROUTE_ROLES /api/devrun (if U12 cancelled)`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_iam_android_qa.md`
- **Verifier (Data & safety) — safe**
  - The 5 files in ~/QA-Automations/testpilot-device-reports become unreachable from the UI. They are untracked and not gitignored, so add them to the R1 archive and the R6 gitignore precondition.
  - Correct sequencing: device-run screenshots are already stripped from the TM blob (lean(), store.ts:721-732; 0 history entries with a screenshot), so R8(6) must land first, as stated.
- **Verifier (Evidence) — safe**
  - deviceRuns=0 in the DB and no assistant /api/devrun calls in Aug-Oct. The plan's own ordering stands: R8(6) must first copy the ios evidence PNGs into the run detail.

### U11 · Asana intake import (V2a) and TmCase.externalRef

**Confidence:** medium

**Paths:**
- `server/qaLoop/intake.ts`
- `server/qaLoop/intake.test.ts`
- `server/api.ts (tmImportHandler, POST /api/tm/import/asana/:gid)`
- `src/screens/tm/AsanaImportModal.tsx`
- `src/lib/asanaImport.ts`
- `src/tm/store.ts (applyAsanaImport 1774-1799)`
- `src/tm/types.ts (TmCase.externalRef, source 'asana')`
- `package.json (test:intake)`

**Why:** It turns Asana task text into TM cases. That is intake, not running or tracking automated tests, and the Asana MCP now does intake in chat. It has never been used. Reviewers wanted to keep it (on probation / as the intake boundary); the user's direction overrides that. The code is self-contained and can be restored from the R1 snapshot if Asana-sourced case import is ever wanted.

**Evidence:** 0 cases with externalRef, no 'asana-import-*' backup reason, and no TM write at all since 2026-09-27, before V2a existed (2026-10-12). October Asana QA (2FA, email OTP, refresh tokens) ran entirely through the Asana MCP. ≈1,570 LOC (parser 809 + tests 211 + modal 327 + client/handler).

**Blast radius:** importFrameworkSpecs keeps @case binding by display key; only the externalRef.caseKey branch goes. The verdict floor's '@case skipped → BLOCKED' rule lives in verdict.ts and stays. normalize must tolerate externalRef in old backups. CLAUDE.md V2a section. server/asana.ts goes with U2.

**Data impact:** None (0 cases carry externalRef).

- **Verifier (Dependencies) — safe**
  - scrubTask in asanaHandler (api.ts:332-340) calls `scrub` from qaLoop/intake. U11 must land with or after U2, or keep scrub.
  - tm/store.ts:16 has `import type { ImportApplied }`. The TmState type declares applyAsanaImport. The externalRef?.caseKey branch sits at :1690 inside importFrameworkSpecs. The local caseKeysFromSpec (:49-54) must stay for @case binding.
  - TestCases.tsx imports AsanaImportModal (:44) and has an asanaOpen button (:245, :600). package.json test:intake goes too.
  - Memory project_qa_autonomy_phase1.md documents V2a and the G3 nonce on the 4 Asana/GitHub routes.
  - Also touch: `server/api.ts:332-340 (scrubTask → intake.scrub)`, `src/tm/store.ts:16,1690`, `src/screens/tm/TestCases.tsx:44,245,600`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_qa_autonomy_phase1.md`
- **Verifier (Data & safety) — safe**
  - Verified: 0 cases with externalRef in the live state and in all 19 backups. The @case binding by display key (store.ts:1693) and the verdict.ts '@case skipped → BLOCKED' rule both stay.
- **Verifier (Evidence) — safe**
  - Not reliance: 0 externalRef cases and no assistant calls to /api/tm/import. But the user explicitly approved building it on 10-12 as part of 'Build Phase 1 locally' (project_qa_autonomy_phase1.md). That memory's 'Next' step is the P1 live pilot on security rock 1.4 (subtask 1219352715851237, due Oct 23), and the Asana-task→@case→verdict loop was built for that pilot. The summary should say outright that this removes 8-day-old approved work just before its first planned use. R12 must update project_qa_autonomy_phase1.md, which describes V2a, the 4 nonce write routes and the ad-hoc guard; R12 doesn't list it.
  - Also touch: `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_qa_autonomy_phase1.md`

### U12 · Login gate, Users & Team, Database unlock, roles, server INC-2 auth, prod Express server, TestPilot-HostReady fork (gated on askUser #1; default = remove)

**Confidence:** medium

**Paths:**
- `src/screens/Login.tsx`
- `src/screens/Users.tsx`
- `src/screens/Database.tsx (replaced by Settings→Data)`
- `src/lib/users.ts (ROUTE_ROLES/canAccess/verifyPassword/SEED_USERS)`
- `server/authStore.ts`
- `server/index.ts`
- `server/api.ts (authHandler, authGuard, API_ROUTE_ROLES, parseCookies, cookieAttrs, /api/auth/login|logout|me)`
- `package.json (start + preview scripts; express, @types/express)`
- `dist/`
- `HOSTING.md`
- `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady`

**Why:** The server binds to loopback behind a Host allowlist, so exactly one person can reach it, and the gate protects nothing. 'Forgot password?' (Login.tsx:56-75) sets a new password on any account, admin included, from just an email, which also defeats the Database unlock. The 5 seeded dev accounts can't sign in. Server auth defaults ON in server/index.ts:35 but no client code calls /api/auth/*, so `npm start` would 401 every /api call. The admin passwordHash literal sits in two files (server/authStore.ts:37, src/lib/users.ts) in a tree headed for a public repo.

**Evidence:** /users had one dev-time visit (08-17) and /database was last opened 07-13. 0 references to /api/auth in src/. The DB has only tm_state/tm_state_backup/tm_seq, so no users/sessions tables were ever created. The LaunchAgent runs only `npm run dev`. HostReady (HEAD 70ec790) has had no file changes since 2026-08-26. ≈1.3k LOC.

**Blast radius:** App.tsx renders the shell directly (no gate, Guard, canAccess or ROUTE_ROLES). The Sidebar footer drops user/sign-out/Users/Database. tm/store.ts actor() uses a constant display name ('Kulvinder Singh', or a TP_ACTOR env). The CLAUDE.md Auth section goes. If the user keeps hosting, this unit is cancelled; the reset hole then has to be closed, the client wired to /api/auth, and Users becomes a Settings tab.

**Data impact:** Only localStorage testpilot.users/testpilot.session. Before deleting HostReady, run git status in it and tar it into ~/QA-Automations/_archive/ if anything is uncommitted.

- **Verifier (Dependencies) — safe**
  - SessionBadge.tsx is a kept component that imports canAccess and gates on users and currentUserId (:5, :15-17). It must be rewritten. The plan does not list it.
  - tm/store.ts actor() (:90-96) and the useStore users/currentUserId/signOut slices need the constant-name replacement.
  - Do not remove tsx with the `start` script. These all run ../TestPilot/node_modules/.bin/tsx: auth:probe in ledgerport-saas-automation, ledgerport-wp-plugin, ledgerport-marketing-site, pushengage-app-dashboard and pushengage-wp-plugin (spawned by the kept session canary and run gate), auth:capture:human, auth:spike-a, spike:b-login, and the qa-core selftest and probe-fixtures.selftest.ts.
  - TestPilot-HostReady is not a git repo or worktree: it has no .git, and `git worktree list` does not show it. 'Run git status in it' is meaningless. All of it is untracked, so tar the whole directory before deleting. Nothing else references it.
  - If U12 is cancelled:
  - - ROUTE_ROLES (users.ts:128-144) has no /runs or /settings entry, so canAccess falls back to ROLE_ORDER, which includes dev. Settings→Data restore would then be reachable by the dev role.
  - - Database.tsx loses its data sources (U1, U2 and U8).
  - Also touch: `src/components/layout/SessionBadge.tsx`, `src/tm/store.ts:90-96 (actor)`, `src/App.tsx:32 (Role import)`, `src/lib/users.ts ROUTE_ROLES (/runs,/settings if cancelled)`
- **Verifier (Data & safety) — safe**
  - requestGuard (Host allowlist + Origin) is mounted separately from authHandler/authGuard (api.ts:1260-1267), so removing auth does not weaken G3. It also closes the 'Forgot password' reset hole.
  - Wrong evidence on HostReady. TestPilot-HostReady is NOT a git repo: rev-parse resolves to the root .git, and it is an untracked `??` dir of 250 MB. 'Run git status in it' is meaningless, and every file in it is uncommitted. It holds SAAS_PLAN.md, a Dockerfile and .dockerignore that exist nowhere else. Archive it unconditionally (excluding node_modules/dist) before deleting it. No LaunchAgent references it.
  - Also touch: `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady/SAAS_PLAN.md (archive first)`
- **Verifier (Evidence) — UNSAFE**
  - There is credible, recent evidence that the user wants TestPilot hosted and multi-user, so 'default = remove' is the wrong default. Evidence, in date order:
  - Aug human prompts match 'testpilot…hosted', 'testpilot…(team|share)' and 'testpilot…login' (1d09ab13, 5daa1727). HOSTING.md is dated 08-17. The private 'shareable repo' KulvinderGosal/TestPilot was created 08-17.
  - HostReady/SAAS_PLAN.md (08-26) lays out a phased multi-user SaaS. project_testpilot_database.md records the Sep 'make it a real website' work, INC-2 server auth DONE 2026-10-12 (8 days ago, built by a user-driven session), 'Target host = a Linux VPS the user is buying', and INC-2b/3/4 pending.
  - Keep the askUser, but make the default KEEP, and name the VPS/INC plan in the question.
  - TestPilot-HostReady is not its own git repo. `git -C TestPilot-HostReady status` reports the parent QA-Automations worktree, and 'HEAD 70ec790' is the parent's HEAD. Everything in it is untracked, including unique code not in TestPilot: server/auth.ts (scrypt sessions), server/db.ts, server/tm.ts (an optimistic-concurrency 409 TM store, prior art for R5), the Dockerfile and SAAS_PLAN.md. 'Tar it if anything is uncommitted' must become 'always archive it'.
  - If the user does choose removal, R1 must archive HostReady and server/index.ts/authStore.ts first, and project_testpilot_database.md must be rewritten.
  - Also touch: `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady/SAAS_PLAN.md`, `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady/server/auth.ts`, `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady/server/db.ts`, `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady/server/tm.ts`, `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady/Dockerfile`

### U13 · TM seed source files, the 11 backfills and the 4 placeholder seed cases

**Confidence:** high

**Paths:**
- `src/tm/mobileSdkSeed.ts`
- `src/tm/iamAndroidSeed.ts`
- `src/tm/iamDashboardSeed.ts`
- `src/tm/iamIosSeed.ts (keep IAM_IOS_ASSERT 133-149: move it next to assessIosRun, store.ts:303-324)`
- `src/tm/iamDeviceSeed.ts`
- `src/tm/ledgerportPr237Seed.ts`
- `src/tm/extensionSeed.ts`
- `src/tm/iamBuild0917Seed.ts`
- `src/tm/recentQaSeed.ts`
- `src/tm/aiOnboardingSeed.ts`
- `src/tm/store.ts (build*/backfill* 96-302 and 326-676, the 11-deep chain at :698, *_SEED_VERSION constants, seed() placeholder cases seedcase-1..4 at 611-621)`

**Why:** Every seq guard in the live DB already equals its code version and all 466 seedcase-* rows exist, so the 11 backfills do nothing on every hydrate. They still ship 169 KB (15.5%) of the client bundle. Three later seeds (iamCollateralSeed, lpIssue19Seed, onb1015Seed) exist only as DB data with no source file, which shows the DB, not the source, is the record. seedcase-1 shows a fabricated 'passed' (runs:1, empty history) that inflates coverage, and seedcase-3/4 are 'automated' with no spec. They are placeholders, not tests.

**Evidence:** GET /api/tm/state seq {mobileSeed:1, iamSeed:3, iamDashSeed:3, iamIosSeed:3, recentQaSeed:1, lpPr237Seed:1, extSeed:1, iam0917Seed:1, aiOnboardingSeed:2, …}. 1,600 LOC / 193 KB of seed source plus ≈570 store LOC; 7 backfills are copy-paste bodies.

**Blast radius:** normalizeAndBackfill shrinks to normalize. seed() for an empty DB creates only the product suites from the registry (R4), or restores from the R1 export. The seq keys stay in the DB (harmless). CLAUDE.md 'Mobile SDK suites' + 'Seeds kept (Phase 1)' paragraphs.

**Data impact:** No change to the 462 real seed cases in the DB. Delete seedcase-1..4 from the DB in one reasoned save ('prune:placeholder-seed-cases'); backup-on-write keeps them recoverable. Do R1's export first: the seed files are the only copy of these cases outside testpilot-tm.db.

- **Verifier (Dependencies) — safe**
  - seed() is also the fresh-DB and offline path, called from load() at :686-698 and from hydrate's server.state===null branch. It uses MOBILE_SDK_SUITES, IAM_ANDROID_SUITES, IAM_DEVICE_SUITES, IAM_DEVICE_CASES, buildMobileCases and buildIamCases (:624-625), plus mock `products`. Rewrite it in the same change (depends on R4).
  - IAM_IOS_ASSERT needs its IosAssert type (iamIosSeed.ts:133) moved with it, for assessIosRun.
  - IAM_MAESTRO_COVERAGE and IAM_IOS_RUNNABLE are used only inside the build* and backfill* functions (store.ts:139, 343, 373, 401). Removing them is safe; runCaseOnDevice reads specFile from the stored cases.
  - Memory project_iam_android_qa.md and project_testpilot_tms_rebuild.md describe the seed files as the mechanism.
  - Also touch: `src/tm/store.ts:566-635 (seed rewrite),686-698 (load)`, `src/tm/iamIosSeed.ts:133 (IosAssert type)`
- **Verifier (Data & safety) — UNSAFE**
  - UNSAFE AS SEQUENCED. The DB prune of seedcase-1..4 will be silently undone by hydrate-reconcile (src/tm/store.ts:1271-1278). It prefers any browser's localStorage mirror that has MORE cases and pushes that whole stale blob, which also reverts every other change made since the mirror was taken.
  - This has already happened. On 2026-09-22 at 16:41 the user's 'dedupe-iam-dashboard (final)' removed 52 imp- cases plus suite imp-suite-pushengage-app-dashboard-in-app-campaigns (backup 9→10, 2960→2908). The 16:48:58 hydrate-reconcile wrote a 2960-case mirror back. No backup exists between #10 and #11, and all 52 cases are in the live DB today (52 cases, all unexecuted).
  - Land U13's prune only after R5(2) and R5(4) are deployed and every open TestPilot tab has been reloaded. Re-apply the 09-22 dedupe in the same reasoned 'prune:' save, after the user confirms.
  - The rest is safe. Every seq guard equals its code version (mobileSeed 1, iamSeed 3, iamDashSeed 3, iamIosSeed 3, aiOnboardingSeed 2, …). Device cases bind through the tags maestro/ios-sim plus the specFile already stored in the DB. IAM_MAESTRO_COVERAGE and IAM_IOS_RUNNABLE are read only inside backfills (store.ts:139,343,373,401), so device runs keep working. Only IAM_IOS_ASSERT is needed at runtime, and the plan keeps it.
  - Also touch: `src/tm/store.ts:1271-1278 (hydrate-reconcile must be removed first — R5)`
- **Verifier (Evidence) — safe**
  - Verified: all 466 seedcase-* rows exist (4+33+27+212+52+44+36+15+13+30), and seq guards match the code versions. The DB also has seq keys iamCollateralSeed/lpIssue19Seed/onb1015Seed with no source, which shows Claude writes seeds straight into the DB; assistant /api/tm/save calls were seen in Sep. After the change the DB, its backups and the R1 archive are the only copies; the private mirror's seeds are stale as of 08-29. R1's sqlite3 .backup must happen before this unit.

### U14 · TM Dashboard, Donut chart and the HTML activity feed (replaced by the Products screen)

**Confidence:** medium

**Paths:**
- `src/screens/tm/Dashboard.tsx`
- `src/components/charts/Donut.tsx`
- `src/tm/store.ts (logActivity HTML strings at ~929 with callers :1419, :1769, :1882)`

**Why:** It is a second dashboard and mostly empty. 4 of its 5 quality tiles depend on removed modules, and the coverage tile is propped up by never-executed seed 'passed' cases. It renders unescaped spec/suite/PR titles via dangerouslySetInnerHTML (Dashboard.tsx:216), a stored-XSS sink in a shared DB. Fleet status per product (R3 Products) is the dashboard the user's scope calls for.

**Evidence:** The '/' hits in transcripts are mostly liveness curls. The activity slice has 53 entries, 8 of them seed messages. With Overview gone (U2), nothing else uses Donut. 229 + ≈80 LOC.

**Blast radius:** '/' becomes Products (R3). Test Cases gets a one-line status-count strip. logActivity stores plain text and is rendered nowhere, or the activity slice is dropped; old entries are tolerated. The CLAUDE.md Dashboard/Overview donut paragraph goes.

**Data impact:** 53 activity entries remain in the state blob unrendered (or are stripped on the next save).

- **Verifier (Dependencies) — safe**
  - The '/' route in App.tsx:64 needs R3's Products element first.
  - Donut is also imported by BugsForPr.tsx and Overview.tsx (both U2), so delete it only with or after U2.
  - Header CRUMBS '/' reads 'Dashboard'.
  - Also touch: `src/App.tsx:5,64`, `src/components/layout/Header.tsx CRUMBS`
- **Verifier (Data & safety) — safe**
  - It removes the dangerouslySetInnerHTML sink (Dashboard.tsx:216) over activity HTML that interpolates suite and spec names. The 53 activity entries survive unrendered.
- **Verifier (Evidence) — safe**
  - No reliance found. The October human prompt matching 'overview…tab' in 5daa1727 couldn't be disambiguated with grep -l; nothing indicates the user wants the TM dashboard kept.

### U15 · Stale root GitHub Actions workflows

**Confidence:** high

**Paths:**
- `/Users/kulvindersingh/QA-Automations/.github/workflows/playwright.yml`
- `/Users/kulvindersingh/QA-Automations/.github/workflows/smoke-tests.yml`
- `/Users/kulvindersingh/QA-Automations/.github/workflows/qa-wp-pushengage-nightly.yml`
- `/Users/kulvindersingh/QA-Automations/.github/workflows/qa-wp-pushengage-pr.yml`
- `/Users/kulvindersingh/QA-Automations/.github/workflows/qa-publish-reports.yml`

**Why:** All five target the pre-reorg layout. smoke-tests.yml runs tests/pushengage-regression/…; the qa-wp-* files use working-directory: tests and tests/package-lock.json; playwright.yml runs `npx playwright test` at the root, where playwright.config.js has been deleted (git status). They can never pass. Two are also leak vectors in a PUBLIC repo. qa-wp-pushengage-nightly.yml interpolates secrets.STAGING_BASE_URL into a `gh issue create --body`, which publishes it in a public issue. qa-publish-reports.yml deploys Playwright reports, which can contain screenshots of logged-in dashboards, to public GitHub Pages. They are replaced by one matrix workflow (R6).

**Evidence:** `gh run list` on KulvinderGosal/QAAutomations: the last 8 runs are all 'failure' on 2026-02-23 (🧪 PushEngage Smoke Tests), nothing since. `gh repo view` → visibility PUBLIC.

**Blast radius:** Repo secrets referenced only by these files (WP_ADMIN_URL, WP_USERNAME, WP_PASSWORD, PLUGIN_NAME, PLUGIN_SEARCH_TERM, STAGING_*, PUSHENGAGE_*) stay in GitHub settings until the user prunes them. Disable the Pages site if it was enabled. Delivered on the R6 branch for review, never pushed automatically.

**Data impact:** Past run logs and artifacts stay on GitHub; no local data.

- **Verifier (Dependencies) — safe**
  - Only .github/workflows/smoke-tests.yml is tracked and on origin/main. It has been workflow_dispatch-only since commit 3f1dca0 (2026-02-23).
  - playwright.yml, qa-publish-reports.yml, qa-wp-pushengage-nightly.yml and qa-wp-pushengage-pr.yml show as `??` (untracked) and are absent from every branch. They were never pushed, so they are not live public leak vectors.
  - Deleting those 4 untracked files cannot be undone through git. R1 must archive them first. Removing smoke-tests.yml from GitHub needs a reviewed commit and push.
  - Also touch: `R1 archive: /Users/kulvindersingh/QA-Automations/.github/workflows/*.yml (untracked)`
- **Verifier (Data & safety) — safe**
  - Wrong evidence. Only smoke-tests.yml is tracked (4 commits); it is the workflow that has been failing since 02-23. playwright.yml, qa-publish-reports.yml, qa-wp-pushengage-nightly.yml and qa-wp-pushengage-pr.yml have 0 commits and are untracked. They never ran on GitHub, so the STAGING_BASE_URL-in-public-issue and Pages leaks never happened.
  - Deleting those four is a permanent local deletion: they are not in git and not in R1's archive scope. Archive them first. Removing smoke-tests.yml is an ordinary, recoverable commit.
  - Also touch: `R1 archive: .github/workflows/{playwright,qa-publish-reports,qa-wp-pushengage-nightly,qa-wp-pushengage-pr}.yml`
- **Verifier (Evidence) — safe**
  - Several factual errors. Only smoke-tests.yml is git-tracked, and it is `workflow_dispatch` only ('Manual trigger only'), so its last runs (02-23) are simply the last manual triggers. playwright.yml, qa-publish-reports.yml, qa-wp-pushengage-nightly.yml and qa-wp-pushengage-pr.yml are untracked (`?? .github/workflows/…`). They were never pushed and never ran on GitHub, and Pages is not enabled (gh api …/pages → 404). The 'leak vectors in a PUBLIC repo' are therefore hypothetical, not live.
  - Deleting the 4 untracked files can't be 'delivered on the R6 branch for review': git shows no diff for removing untracked files. They are also the only copy, so archive them in R1 first.
  - playwright.yml is the `npm init playwright` scaffold created 2026-08-15 19:04:22, together with a root playwright.config.ts (testDir ./PlaywrightTests, html reporter, 3 browsers), PlaywrightTests/example.spec.ts, and the @playwright/test and @types/node devDependencies in root package.json. The plan's claim that the root playwright config 'has been deleted' is wrong; the deleted file is the old playwright.config.js. Remove the whole scaffold together, or leave it, since it may be the user's own VS Code playground.
  - Also touch: `/Users/kulvindersingh/QA-Automations/playwright.config.ts`, `/Users/kulvindersingh/QA-Automations/PlaywrightTests/example.spec.ts`, `/Users/kulvindersingh/QA-Automations/package.json (devDependencies added by the 08-15 scaffold)`

### U16 · pushengage-android-sdk runner registry entry

**Confidence:** medium

**Paths:**
- `server/runner.ts (FRAMEWORKS entry ~266-283)`

**Why:** It has 0 runs, its notes contradict the iam-android entry ('no JDK/SDK/maestro on host' vs 'host has the toolchain'), and it allows command mode only. iam-android already runs on-device Maestro flows and becomes the 'PushEngage Android SDK' product card (R3/R4), so the fleet keeps exactly one Android SDK and one iOS SDK surface.

**Evidence:** 0 of 200 history entries; iam-android has 33 maestro runs.

**Blast radius:** The FRAMEWORKS list goes from 11 to 10 Products cards. The CLAUDE.md Maestro paragraph. The ~/QA-Automations/pushengage-android-sdk folder (SDK source + 7 .maestro flows) stays on disk; its flows can be added to the Android card's flow picker later.

**Data impact:** None (mobile seed cases are manual with frameworkId null).

- **Verifier (Dependencies) — safe**
  - No schedule, persona, TM case or skill references it. .testpilot-schedules.json holds only pushengage-site and ledgerport-marketing-site.
  - The root ~/QA-Automations/package.json 'android' dispatcher (npm --prefix pushengage-android-sdk) keeps working without TestPilot. Only descriptive text references TestPilot: pushengage-android-sdk/package.json:4 and the smoke-monitor/run-all-smoke.sh comment.
  - Also touch: `/Users/kulvindersingh/QA-Automations/pushengage-android-sdk/package.json:4 (description, cosmetic)`
- **Verifier (Data & safety) — safe**
  - Verified: no schedule references it (the 4 jobs are ledgerport-marketing-site and pushengage-site), it has no auth personas, and no TM case has that frameworkId.
- **Verifier (Evidence) — UNSAFE**
  - This conflicts with the user's stated scope ('mobile SDKs'). This entry is the only core (non-IAM) Android SDK automation in the registry. Its 7 Maestro flows in ~/QA-Automations/pushengage-android-sdk/.maestro cover app-launch, permission grant/deny, subscribe/registers-device, unsubscribe, segment and attributes; they match the 33 seeded 'PushEngage Android SDK' manual cases. iam-android is the IAM PR #34 harness only.
  - Relabelling iam-android as 'PushEngage Android SDK' while deleting this entry leaves core push-subscription flows unreachable from TestPilot. The plan defers them to 'later'.
  - 0 runs is true, but removal should land only together with adding these flows to the Android card's Flow… picker (R4), or the entry should be kept as the card's second flow source.
  - Also touch: `/Users/kulvindersingh/QA-Automations/pushengage-android-sdk/.maestro (fold into the Android card flow picker in R4)`

### U17 · Scheduler free-form 'run any npm script now' terminal

**Confidence:** high

**Paths:**
- `src/screens/Schedule.tsx (terminal + per-script Run buttons ~:100)`

**Why:** It is a third copy of the run-a-script UI. Running a script moves to the single run control on each Products card ('Script…' mode, R3), so Schedules & CI only manages jobs.

**Evidence:** No /schedule navigation or /api/schedule call by a human since 2026-07-27; the testpilot-qa skill manages schedules through the API.

**Blast radius:** GET /api/runner/scripts stays (Products Script mode and the schedule-create picker).

**Data impact:** None.

- **Verifier (Dependencies) — safe**
  - Schedule.tsx uses fetchScripts (lib/runner) and useStore startPlaywrightRun. Both must stay for the Products 'Script…' mode and the schedule-create picker. No external caller.
- **Verifier (Data & safety) — safe**
- **Verifier (Evidence) — safe**
  - The user asked for it in July ('run any npm command… type and run'), but the capability moves to the Products card's Script… mode, so nothing is lost. GET /api/runner/scripts stays.

### U18 · Dead exports, dead store actions and unused npm dependencies

**Confidence:** high

**Paths:**
- `package.json (@radix-ui/react-checkbox, react-dropdown-menu, react-select, react-slot, react-tabs, react-tooltip, class-variance-authority, @tanstack/react-query; move tsx to devDependencies)`
- `src/main.tsx (QueryClientProvider)`
- `src/lib/tmStore.ts (nextSeqRemote, seedSeqRemote; listTmBackups/restoreTmBackup get wired in R10, not deleted)`
- `src/lib/tone.ts (ISSUE_STATE_TONE, toneStyle)`
- `src/components/ui/primitives.tsx (Dot)`
- `src/tm/store.ts (moveSuite 1315-1332; case comments/review actions addCaseComment/setCaseReview and their CaseDetail UI)`
- `server/runner.ts (legacy sessionInfo()/SessionInfo/FrameworkHealth.session 357-418)`
- `src/lib/runner.ts (SessionInfo type :36)`
- `server/tmStore.ts (hasState)`
- `server/tmStore.ts + server/api.ts (/api/tm/seq/next, /api/tm/seq/seed: no client, tm_seq has 0 rows)`

**Why:** Nothing calls any of these. The legacy file-age sessionInfo reports 'stale' for every auth framework, contradicting the I1 probes (warn/block), and is recomputed on every /api/runner/frameworks call. React Query costs 24.5 KB for zero queries. Case comments (0) and review (all 3,060 'approved') are unused workflow features.

**Evidence:** deadCode lists in the frontend/server/stores/codeHealth inventories (0 references). tsc and oxlint are clean today, so removal is mechanical.

**Blast radius:** package.json/lockfile and imports only. /api/runner/frameworks drops the unread `session` field; the testpilot-qa skill doesn't read it (verify in R2's contract test).

**Data impact:** None.

- **Verifier (Dependencies) — safe**
  - Verified with no importer: @radix-ui/react-checkbox, react-dropdown-menu, react-select, react-slot, react-tabs, react-tooltip and class-variance-authority. @tanstack/react-query is used only by main.tsx.
  - @radix-ui/react-popover has exactly one consumer, FilterMenu.tsx, which U2 and U9 may delete. That would contradict the KEEP list.
  - Moving tsx to devDependencies is fine. tsx must stay installed for the framework auth:probe scripts and the qa-core selftest.
  - Removing the legacy sessionInfo leaves a stale comment in ledgerport-shopify/utils/capture-auth.ts:100, which mirrors to 'the legacy path TestPilot's session watcher reads'. Harmless.
  - Memory project_testpilot_database.md lists /api/tm/seq.
  - Also touch: `/Users/kulvindersingh/QA-Automations/ledgerport-shopify/utils/capture-auth.ts:100 (stale comment)`
- **Verifier (Data & safety) — safe**
  - moveSuite has zero callers, but R3 lists suite 'move' as kept. That means moveCases; reword R3.
  - review is only displayed (Dashboard.tsx:54, TestCases.tsx:481/901/965), never used to filter runs. All 3,060 cases are 'approved' and tm_seq has 0 rows, so removal is safe.
- **Verifier (Evidence) — safe**
  - Verified: the only @radix-ui imports in src are react-dialog and react-popover; @tanstack/react-query is used only by the empty QueryClientProvider in src/main.tsx; the FrameworkHealth.session field (runner.ts:452) is never read in src or run-product.sh.
  - setCaseReview/addCaseComment are wired in TestCases.tsx:879-1015, so they are a live but unused UI feature rather than dead code. Removing them is fine; just don't describe it as mechanical dead-code removal.

## B. Refinements (priority order)

### R1 · Snapshot code + data privately before any deletion  _(P1, effort S)_

**What:** (a) Archive TestPilot/ (excluding node_modules, dist, .env, .auth, .testpilot-*.json), packages/qa-core/ and config/fixtures.json as a dated git bundle or tarball under ~/QA-Automations/_archive/testpilot-2026-10-20/ (_archive/ is gitignored, root .gitignore:35). (b) Put a `sqlite3 .backup` copy of testpilot-tm.db (not cp, because the 13.6 MB WAL hasn't been checkpointed) and a GET /api/tm/state JSON export in the same archive, never in the repo: root .gitignore:60-61 says the DB holds captured JWTs and the repo is PUBLIC. (c) Do the removal units as one commit each on a local branch, and run `npm run build && npm run lint && npm test` after each. Push nothing until the user has reviewed the diff and a secret scan; strip the admin passwordHash literal (server/authStore.ts:37, src/lib/users.ts) if U12 is cancelled. (d) Edit server/*.ts only while GET /api/runner/runs shows nothing running and outside the Sun/Wed 08:00 monitor windows, because every server edit restarts the LaunchAgent's Vite and turns an in-flight run into NOT_RUN.

**Why:** Only 5 TestPilot files are git-tracked (112 status entries); packages/qa-core has 0 tracked files. server/api.ts, qaLoop, sessions and scheduler exist only on disk. The DB is the only copy of the 100 curated case-suite-* results and of 3 seed guards.

**Paths:** `/Users/kulvindersingh/QA-Automations/TestPilot`, `/Users/kulvindersingh/QA-Automations/packages/qa-core`, `/Users/kulvindersingh/QA-Automations/config/fixtures.json`, `/Users/kulvindersingh/QA-Automations/testpilot-tm.db`

- **Verifier (Dependencies) — safe**
  - The archive scope misses:
  - - the 4 untracked root workflows (U15);
  - - TestPilot-HostReady, which is a plain untracked copy, not a repo;
  - - ~/QA-Automations/.claude/skills (project skills).
  - 'One commit each on a local branch' does not isolate the work. TestPilot has 5 tracked files and everything else is untracked, and the LaunchAgent com.testpilot.dev runs `npm run dev` from this same directory (plist WorkingDirectory). Every server/*.ts edit hot-restarts the live server and kills in-flight runs. A broken intermediate state is kept silently: Vite catches the error and logs 'server restart failed' (node_modules/vite/dist/node/chunks/node.js:25770). It surfaces as a crash-loop on the next reboot. Prune in a copy and swap it in when green.
  - Also touch: `/Users/kulvindersingh/QA-Automations/.github/workflows`, `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady`, `/Users/kulvindersingh/Library/LaunchAgents/com.testpilot.dev.plist (same working dir)`
- **Verifier (Data & safety) — UNSAFE**
  - The safety net is under-scoped. It excludes .testpilot-*.json: .testpilot-runs.json (200-entry history), the 60 .testpilot-detail-*.json Run Story files (4.2 MB), .testpilot-schedules.json and .testpilot-sessions.json. The plan itself calls run history 'the only usage and evidence record', and R7/R11 modify these files. They hold no secrets: schedule keys are id/framework/script/env/cadence/lastRun*/blockedOn, and verdict text is redact()ed. They belong in the gitignored _archive with the DB.
  - Also missing from the archive: the 4 untracked workflows (U15), TestPilot-HostReady minus node_modules (U12), testpilot-device-reports/ (U10) and testpilot-qa-records/.
  - sqlite3 3.54 is at /usr/bin/sqlite3, and `.backup` against the live WAL DB is safe. Verify the copy by opening it and counting the 19 backup rows and 3,060 cases before any deletion.
  - Also touch: `/Users/kulvindersingh/QA-Automations/TestPilot/.testpilot-runs.json`, `/Users/kulvindersingh/QA-Automations/TestPilot/.testpilot-detail-*.json`, `/Users/kulvindersingh/QA-Automations/TestPilot/.testpilot-schedules.json`, `/Users/kulvindersingh/QA-Automations/TestPilot/.testpilot-sessions.json`, `/Users/kulvindersingh/QA-Automations/.github/workflows/`, `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady`, `/Users/kulvindersingh/QA-Automations/testpilot-device-reports`
- **Verifier (Evidence) — UNSAFE**
  - The archive scope excludes `.testpilot-*.json`. That drops .testpilot-schedules.json (the 4 Sun/Wed monitor jobs that R7 edits) and .testpilot-runs.json (the 200-entry run history that R11 calls the only usage record). Archive those two and exclude only the detail-*.json files.
  - The scope also omits the untracked root workflows and scaffold (U15), TestPilot-HostReady (U12), the launchd smoke-monitor plists (R7/askUser #3) and the localStorage qaLog/savedTests export.
  - Also touch: `/Users/kulvindersingh/QA-Automations/TestPilot/.testpilot-schedules.json`, `/Users/kulvindersingh/QA-Automations/TestPilot/.testpilot-runs.json`, `/Users/kulvindersingh/QA-Automations/.github/workflows`, `/Users/kulvindersingh/QA-Automations/TestPilot-HostReady`, `/Users/kulvindersingh/Library/LaunchAgents/com.awesomemotive.qa.smoke-all.plist`, `/Users/kulvindersingh/Library/LaunchAgents/com.awesomemotive.qa.smoke-auth-ctas.plist`

### R2 · Safety net: contract tests for kept external routes + typecheck the server  _(P2, effort M)_

**What:** Add `npm run test:contract` (node:test via tsx, the same pattern as test:verdict). It mounts mountAll on an ephemeral port with a stubbed runner and scheduler, and asserts status and response shape for every route an outside caller uses: GET /api/runner/frameworks; POST /api/runner/runs with Origin → {run:{id,status}}; GET /api/runner/runs/:id?offset → status, verdict{state,cls,counts,reason,humanAction}, output; GET /api/runner/scripts; GET /api/reports/history → history[].id/verdict; GET /api/sessions[?cached=1]; /api/schedule list|create|:id/run|:id/toggle|alert-status|test-alert; GET /api/tm/state and POST /api/tm/save {state,reason}. It also asserts that the G3 refusals still fire (421 host-not-allowed, 403 origin-required, bad-nonce). Extend tsconfig.node.json `include` to server/**/*.ts and server/qaLoop/*.test.ts. Add an aggregate "test" script (test:verdict + test:contract). Clear the 11 oxlint warnings.

**Why:** The testpilot-qa skill (run-product.sh) and Claude's /api/tm/* sessions are the real API consumers, and nothing protects their contracts during a ~20k-line prune. Today tsconfig.node.json typechecks only vite.config.ts and what it transitively imports.

**Paths:** `server/api.ts`, `server/qaLoop/`, `tsconfig.node.json`, `package.json`, `/Users/kulvindersingh/.claude/skills/testpilot-qa/scripts/run-product.sh`

- **Verifier (Dependencies) — UNSAFE**
  - As specced, the tests would mutate live state:
  - - POST /api/tm/save would write the real shared DB, because tmStore's DB_PATH is hard-coded via homedir() (server/tmStore.ts:33-34).
  - - POST /api/schedule create and toggle would rewrite the live cwd-relative .testpilot-schedules.json (scheduler.ts:43).
  - - GET /api/sessions without cached=1 spawns real `npm run auth:probe` in the framework dirs and writes .testpilot-sessions.json (sessions.ts:494).
  - - test-alert fires a real macOS notification.
  - Fix: run with a temp cwd and HOME, or add a DB-path override, and use cached=1.
  - The asserted /api/runner/frameworks shape must reflect U8 (drops `adhoc`), U18 (drops `session`) and R4 (adds fields).
  - Also touch: `server/tmStore.ts:33-34 (needs a test override)`, `server/scheduler.ts:43, server/sessions.ts:494, server/runner.ts:732 (cwd-relative state files)`
- **Verifier (Data & safety) — UNSAFE**
  - As specified, the tests would write to live data. DB_PATH is a hard-coded const (server/tmStore.ts:33-34, ~/QA-Automations/testpilot-tm.db) with no override, so asserting POST /api/tm/save overwrites the real TM state. Each call also pushes a backup, rotating real snapshots toward the 50 cap.
  - The schedule, run-history and session files resolve to process.cwd(), which is the TestPilot root under npm (scheduler.ts:43, runner.ts:732, sessions.ts:494). Three consequences follow. (1) POST /api/schedule creates a real job; the LaunchAgent's scheduler loads it on its next restart and fires it against production. (2) Concurrent writes clobber the live server's .testpilot-runs.json and .testpilot-sessions.json. (3) GET /api/sessions without cached=1 spawns real `npm run auth:probe` in the framework dirs, and test-alert sends a real notification.
  - Fix: add a TP_DATA_DIR / TP_TM_DB override, chdir to a temp dir, and stub the runner, scheduler and sessions so no real spawn can happen.
  - The /api/tm/save assertion conflicts with R5's baseRev requirement; update it when R5 lands.
  - tsconfig.node.json is noEmit, and vite.config.ts already transitively typechecks server/api.ts imports, so the include change is low-risk.
  - Also touch: `server/tmStore.ts:33-34 (DB path override)`, `server/scheduler.ts:43`, `server/runner.ts:732,800`, `server/sessions.ts:494`

### R3 · Target information architecture: 5 nav items, one run surface  _(P3, effort L)_

**What:** NAV (Sidebar.tsx, 22 visible items → 5): Products `/` · Test Cases `/tests` · Runs `/runs` (+ `/runs/:id`) · Schedules & CI `/schedule` · Settings `/settings`. A catch-all `*` route goes to `/`. HEADER: brand toggle (PushEngage / LedgerPort / All), honoured by all four content screens; SessionBadge; theme toggle; TM 'DB offline' banner (R5). No bell, no global search. (1) PRODUCTS replaces TM Dashboard, Overview, Test Runner and the Pipelines cards. It shows 10 cards from /api/runner/frameworks (R4): PE marketing site, PE app dashboard, PE WP plugin, PE Shopify, PE Android SDK (iam-android, maestro), PE iOS SDK (iam-ios, ios-sim), LP marketing site, LP SaaS, LP WP plugin, LP Shopify. Each card shows the last local verdict (state + reason + humanAction via verdictNote), a CI chip (R6) linking to the GitHub run, a persona chip (ok/warn/block + Copy capture cmd), the next scheduled fire, and the latest master commit (read-only). Each card has ONE Run control: mode Smoke | Full | Spec… (spec picker from /api/runner/specs) | Script… (npm scripts from /api/runner/scripts, i.e. command mode) | Flow… (mobile), plus env and headed. A top banner reads 'N sessions need you' with their capture commands. The single shared RunPanel is docked at the bottom. (2) TEST CASES: the existing suite tree and case list. The default filter is Automated, with a toggle for All. It keeps select-all, Run selected (sequential), Stop, staging/production env with a production confirm (R8), Run on device, Import from frameworks (refresh, marks stale, never deletes), and suite add/rename/clone/move/delete. The case modal shows steps, verdict notes and history rows linking to /runs/:id. It adds a status-count strip and the docked RunPanel. Removed: Copilot, Asana import, comments/review, plan and requirement fields, the DeviceRunReports modal. (3) RUNS: the history table from /api/reports/history (filter by product, verdict and source: manual/scheduled/case), with rows linking to Run Story. It replaces Reports and QA Log. (4) SCHEDULES & CI: local jobs (list/create/toggle/run-now/delete, last verdict, session-blocked state) plus the read-only CI panel per product (R6). It replaces Pipelines and the Scheduler terminal. (5) SETTINGS has three tabs. Sessions is the Test sessions panel moved from TestRunner.tsx (per-persona state, Re-probe, Verify live, Copy capture cmd). Fixtures is the read-only registry view moved from /fixtures; the Integrations test-store bookmarks derive from it. Data lists TM backups with restore (R10) and export. Retire the routes /overview, /queue, /queue/:id, /runner, /pipelines, /manual, /qa-log, /fixtures, /reports, /skb-docs, /integrations, /users, /database and all /tests/* subroutes.

**Why:** The user asked for a stupid-simple tool with roughly 4-6 menus. Today 10 UIs start real runs (TestRunner, TestPlans RunAutomation, TaskRunnerCard, Pipelines, the Scheduler terminal and run-now, the Reports builder and Re-run 5×, ManualTest, TestCases, TestRuns, QaQueue), plus 6 simulated 'run' buttons. The brand toggle shows everywhere but only 6 screens read it. Collapsing to one run control per product, and one case-run path in Test Cases, covers every real run in the 200-run history.

**Paths:** `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/screens/TestRunner.tsx (becomes src/screens/Products.tsx)`, `src/screens/Reports.tsx (becomes src/screens/Runs.tsx)`, `src/screens/RunStory.tsx`, `src/screens/Schedule.tsx`, `src/screens/Fixtures.tsx`, `src/screens/tm/TestCases.tsx`, `src/screens/runner/RunPanel.tsx`, `src/components/layout/SessionBadge.tsx`

- **Verifier (Data & safety) — safe**
  - The new Products run control must never send sessionGate:false. The server honours it and skips the I1 gate (runner.ts:1294).
  - TestRunner has no production confirm today, and R8(7) covers only Test Cases. Add the same ConfirmDialog when a Products card's env is production.
  - SessionBadge and any text that links to /runner must move to /settings.
  - Also touch: `src/components/layout/SessionBadge.tsx (/runner link)`

### R4 · One framework/product registry (server is the single source)  _(P4, effort M)_

**What:** Add `productId`, `brand` ('pushengage'|'ledgerport'), `surface` ('marketing-site'|'dashboard'|'saas'|'wp-plugin'|'shopify'|'android-sdk'|'ios-sdk') and `label` to each FRAMEWORKS entry in server/runner.ts, and return them from /api/runner/frameworks (additive, so the skill stays safe). Derive the Products cards, the brand filter and the TM suite↔framework binding from that response. Delete the client copies: TM_FRAMEWORKS (src/tm/types.ts:341, 8 of 11 entries, missing the mobile ones), FRAMEWORK_PRODUCT (src/tm/store.ts ~57), PRODUCT_FRAMEWORK (src/lib/qaPlanner.ts:35, with the lp-shopify→ledgerport-saas-automation bug at :43) and the mock product catalog (src/data/mock.ts:70-178, fake coverage %). Relabel iam-android as 'PushEngage Android SDK' and iam-ios as 'PushEngage iOS SDK', keeping the ids, because run history and 61 TM device-case bindings reference them. Move the hard-coded maestro/iOS APP_ID defaults from runner.ts into config/fixtures.json, read via qa-core loadFixtures.

**Why:** Three registries have drifted, and one already sends LedgerPort Shopify work to the SaaS suite. The products catalog lives in a file called mock.ts with fake data, and the seed suites reference productIds (pe-android-sdk/pe-ios-sdk) that aren't in it. A server-owned registry is also what CI's matrix (R6) and its status mapping key on.

**Paths:** `server/runner.ts`, `src/tm/types.ts`, `src/tm/store.ts`, `src/lib/qaPlanner.ts`, `src/data/mock.ts`, `/Users/kulvindersingh/QA-Automations/config/fixtures.json`

- **Verifier (Dependencies) — safe**
  - The new productId values must equal the existing suite productIds: pe-site, pe-app-dashboard, pe-shopify, pe-wp-plugin, lp-dashboard (for ledgerport-saas-automation), lp-wp-plugin, lp-shopify, lp-site, plus pe-android-sdk and pe-ios-sdk. importFrameworkSpecs finds the root suite by productId (tm/store.ts:1651-1664), so other values would create new suite-fw-<id> roots on re-import.
  - brand and label already exist on every FRAMEWORKS entry.
  - TestCases 'Import from frameworks' iterates TM_FRAMEWORKS (TestCases.tsx:1333, 1353, 1360). Switching it to the server list adds the maestro and ios-sim frameworks, which return no specs.
  - Also touch: `src/screens/tm/TestCases.tsx:937,1143,1333-1360 (TM_FRAMEWORKS consumers)`, `src/screens/tm/TestRuns.tsx:7,194 (dies with U5)`
- **Verifier (Data & safety) — safe**
  - The new productId values must equal the existing suite productIds: pe-site, pe-app-dashboard, pe-shopify, pe-wp-plugin, lp-dashboard, lp-wp-plugin, lp-shopify, lp-site, pe-android-sdk, pe-ios-sdk. Otherwise importFrameworkSpecs (store.ts:1661) misses the product suite and creates a new `suite-fw-<fw>` root, splitting newly imported cases from the tree.
  - Import must refuse when the registry fetch fails; FRAMEWORK_PRODUCT is static today. Persona ids `<fw>:<env>` must not change.
  - Moving the maestro/iOS APP_ID defaults into fixtures.json makes every device run depend on qa-core loadFixtures succeeding, and it 422s on any secret-shaped key or duplicate id. Keep the built-in defaults as a fallback, and keep the staging site as the default.

### R5 · TM write integrity: no silent overwrites of the shared DB  _(P5, effort M)_

**What:** (1) Add a monotonic `rev` to tm_state. GET /api/tm/state returns it; POST /api/tm/save requires `baseRev` and returns 409 {rev} on a mismatch; the client re-hydrates and re-applies its single mutation. Scripted saves pass the baseRev from their own GET; for one-off bulk edits, `force:true` with a reason starting 'script:'/'prune:'. (2) Delete the case-count reconcile at src/tm/store.ts:1271 and its 'hydrate-reconcile' push. (3) When hydrate can't reach the server (store.ts:1252-1253), go read-only and show the Header 'DB offline, changes not saved' banner; don't arm pushToServer (store.ts:925) on a stale mirror. (4) Drop the full 2.4 MB localStorage mirror: it sits near the ~5 MB quota and save() swallows QuotaExceededError. (5) Coalesce mutations into one debounced save, and in bulk runs persist once per run, not per case. (6) Turn the saveState >90%-drop warning (server/tmStore.ts:162) into a refusal unless reason starts with 'prune:'.

**Why:** Every server/*.ts edit restarts the LaunchAgent's Vite (149 restarts logged). Any tab that hydrated before a Claude /api/tm/save, or during a restart, can overwrite the whole DB last-writer-wins. Backup #10 (2908 cases after 2960) shows the reconcile path firing. The DB is the only durable record of results, and useTm.serverDown is set but never shown.

**Paths:** `server/tmStore.ts`, `server/api.ts`, `src/lib/tmStore.ts`, `src/tm/store.ts`, `src/components/layout/Header.tsx`

- **Verifier (Dependencies) — safe**
  - Requiring baseRev on POST /api/tm/save changes a contract that Claude sessions use directly (memory project_testpilot_database.md and project_testpilot_tms_rebuild.md:83). The new contract and the 'script:'/'prune:' force reasons must be documented there in R12. The hydrate migrate and seed saves (tm/store.ts:1259-1262) also need baseRev handling.
  - Also touch: `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_testpilot_database.md`
- **Verifier (Data & safety) — UNSAFE**
  - The core (remove the reconcile, add rev/409) is strongly justified. Backup 10→11 shows the reconcile re-adding the 52 cases the user deduped on 09-22. It must land before U13's prune.
  - (6) refuses a >90% drop unless the reason starts with 'prune:'. That also blocks restoreBackup, which saves with reason `restore-<id>` (tmStore.ts:206), when the backup is small. The undo path itself would be refused; exempt restore-*.
  - (5) 'in bulk runs persist once per run' widens the loss window. A multi-hour runCases interrupted by one of the frequent Vite restarts (149 logged) or a tab close loses every verdict write-back; today they persist per case. Keep debounced per-case saves.
  - (4) dropping the mirror while pushToServer only console.warns on failure (store.ts:747-750) means a save attempted during a Vite restart is silently lost. Add a retry queue and re-try hydrate, not a tab that stays permanently read-only.
  - (1) 're-apply its single mutation' isn't possible with whole-blob set() closures plus coalesced saves. Define re-apply for the verdict write-back op, or show the conflict; never auto-force.
  - Update the scripted GET→append→POST pattern in memory project_testpilot_tms_rebuild.md, which still says 'no Origin header ⇒ same-origin passes' (already false under G3).
  - Also touch: `server/tmStore.ts:198-207 (restoreBackup reason exemption)`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_testpilot_tms_rebuild.md`

### R6 · Make CI real: one GitHub Actions matrix + the same verdict floor + a CI view in TestPilot (proposed on a branch, never pushed)  _(P6, effort L)_

**What:** PRECONDITION. CI can only run code it can check out. Today pushengage-app-dashboard, ledgerport-saas-automation, ledgerport-shopify and packages/qa-core have 0 tracked files in the root repo; pushengage-site has 1, pushengage-wp-plugin 3, pushengage-shopify-revamped 6. ledgerport-wp-plugin is its own public repo (KulvinderGosal/wordpress-ledgerport-autmation), and the LP marketing framework lives in awesomemotive/pushengage-ledgerport-site (11 test files on master). The frameworks + qa-core must first be committed to the repo chosen in askUser #2, after a secret scan; .env and .auth/ are already gitignored. WORKFLOW `.github/workflows/qa-fleet.yml` (replaces U15). Triggers: `on: schedule` (cron '30 2 * * 0,3' = Sun/Wed 08:00 IST) + `workflow_dispatch` (inputs: framework, script). NO pull_request/pull_request_target, so forks of a public repo never get secrets. `permissions: contents: read`. Job `qa (${{ matrix.id }})` with `strategy: {fail-fast: false, matrix: {include: [...]}}`, `timeout-minutes: 45`, `concurrency: qa-${{ matrix.id }}`. PHASE-1 LEGS are the suites that need no human-captured session: {id: pushengage-site, dir: pushengage-site, script: test:scheduled:prod}, {id: ledgerport-marketing-site, dir: ledgerport-sites/pushengage-ledgerport-site, script: test:scheduled:prod}, {id: ledgerport-saas-automation, dir: ledgerport-saas-automation, script: test:public}. STEPS: actions/checkout and setup-node (Node 22) pinned by SHA, npm cache keyed on `${{ matrix.dir }}/package-lock.json`; then in `working-directory: ${{ matrix.dir }}`: `npm ci`, `npx playwright install --with-deps chromium`, `npm run ${{ matrix.script }} -- --reporter=list,json` with env `CI=1` and `PLAYWRIGHT_JSON_OUTPUT_NAME=$RUNNER_TEMP/results.json`; per-leg secrets go only in an `env:` block, never echoed and never placed in run arguments or issue bodies. Then `npx tsx TestPilot/scripts/ci-verdict.ts $RUNNER_TEMP/results.json`, a ~40-line wrapper around the pure `deriveVerdict` in server/qaLoop/verdict.ts (it needs qa-core/errors committed). CI then gets the same PASS/PASS_WITH_GAPS/FAIL/BLOCKED/NOT_RUN floor: it writes verdict.json and a $GITHUB_STEP_SUMMARY table, exits 1 only on FAIL, and on BLOCKED exits 0 with ::warning. Upload artifacts `if: always()`: playwright-report/, results.json, verdict.json, retention-days 14, trace/video off on prod legs, with no GitHub Pages publishing. PHASE 2, only after a local proof: WP-admin legs that log in from secrets without a captcha (ledgerport-wp-plugin is selfHeal from WP_ADMIN_USER/PASS; pushengage-wp-plugin staging), with secrets in a GitHub Environment `qa-staging` that requires a reviewer. STAYS LOCAL: the Shopify, app-dashboard and LP SaaS/Shopify staging legs (their sessions need Turnstile/hCaptcha/passkey/2FA by a human; never upload .auth storageState as a secret) and mobile (Maestro/iOS sim). Those run through the local Scheduler behind the I1 gate. CLOUDFLARE CAVEAT: GitHub-hosted IPs may be challenged on pushengage.com/ledgerport.com. The verdict floor reports that as BLOCKED{ENV}, not FAIL. If it happens, use a self-hosted Mac runner, which is safe only in a PRIVATE repo. TESTPILOT SIDE: Pipelines is replaced, not merged (U7). Add a read-only `GET /api/ci/status` in server/github.ts: GitHub REST `GET /repos/{TP_CI_REPO}/actions/workflows/{TP_CI_WORKFLOW}/runs?per_page=5`, then `/actions/runs/{id}/jobs`; map job name `qa (<id>)` to framework id; return [{framework, conclusion, startedAt, durationSec, htmlUrl}], cached 5 min, needing only GITHUB_TOKEN read access. Render it as the CI panel on Schedules & CI and a chip on each Products card. Phase 1 has no 'Run in CI' button, because workflow_dispatch is a write; it can be added later behind ConfirmDialog + nonce. Once a CI leg is green for 2 consecutive cycles, disable its duplicate local schedule. Deliver the workflow, ci-verdict.ts and the CI view as a local branch plus diff for review.

**Why:** The user asked to keep the CI/CD pipeline in mind. The existing workflows can't pass, two of them leak data in a public repo, and the local Pipelines feature has never run. One matrix that calls each framework's own scripts is the simplest CI that matches how the suites are actually run. Reusing deriveVerdict means CI and TestPilot report the same honest state, and linking runs from TestPilot keeps one place to look.

**Paths:** `/Users/kulvindersingh/QA-Automations/.github/workflows/qa-fleet.yml (new)`, `TestPilot/scripts/ci-verdict.ts (new)`, `server/qaLoop/verdict.ts`, `server/github.ts`, `server/api.ts`, `src/screens/Schedule.tsx`, `/Users/kulvindersingh/QA-Automations/pushengage-site/package.json`, `/Users/kulvindersingh/QA-Automations/ledgerport-sites/pushengage-ledgerport-site/package.json`, `/Users/kulvindersingh/QA-Automations/ledgerport-saas-automation/package.json`

- **Verifier (Dependencies) — safe**
  - Paths and tooling:
  - - `npx tsx TestPilot/scripts/ci-verdict.ts` would run inside `working-directory: ${{ matrix.dir }}`, so the path must be $GITHUB_WORKSPACE/TestPilot/….
  - - No step installs TestPilot's deps, so npx would fetch an unpinned tsx.
  - - ci-verdict imports server/qaLoop/verdict.ts, which imports packages/qa-core/errors.ts (0 tracked files).
  - Repo and side-effect concerns:
  - - ledgerport-sites/pushengage-ledgerport-site and ledgerport-wp-plugin are nested git repos with their own .git, so the root repo cannot check them out without a cross-repo token.
  - - pushengage-site test:scheduled:prod submits real contact forms. CI and the local schedules would double-submit until the local jobs are disabled.
  - Also touch: `/Users/kulvindersingh/QA-Automations/ledgerport-sites/pushengage-ledgerport-site/.git (nested repo)`
- **Verifier (Data & safety) — UNSAFE**
  - Verdict-floor regression. ci-verdict exits 0 on BLOCKED, but /api/ci/status and the 'green 2 cycles → disable the local schedule' rule read GitHub's job conclusion. A leg challenged by Cloudflare on GitHub IPs (BLOCKED{ENV}) would show 'success' and could switch off the real local monitor. Base the chip and the rule on verdict.json state==PASS with executed>0, for example the job summary/output or the artifact.
  - PLAYWRIGHT_JSON_OUTPUT_NAME=$RUNNER_TEMP/results.json in an `env:` block is not shell-expanded; use ${{ runner.temp }}. ci-verdict must treat a missing or empty JSON as BLOCKED{HARNESS}, never fall back to exit code 0 = PASS.
  - Commit-scope leak precondition. Untracked and NOT gitignored: config/ (fixtures.json with account/site/realm ids), testpilot-qa-records/, testpilot-device-reports/ (base64 device screenshots), TestPilot-HostReady/, and the framework smoke-reports/ dirs (pushengage-app-dashboard, pushengage-site). A secret scan won't catch identifiers or screenshots, so gitignore them before any commit. Committing packages/qa-core publishes PRODUCTION_READ_ALLOWLIST and the staging host lists.
  - On a PUBLIC repo, run logs and artifacts are readable by any signed-in GitHub user. In option (b), upload only verdict.json plus redacted results and no playwright-report. Phase-2 WP-admin legs belong in a private repo only.
  - Never set SUBMIT_FORMS, SMOKE_SUBMIT_FORMS, ALLOW_PROD_FORM_SUBMIT, RUN_MANUAL_OTP or SIGNUP_PASSWORD in CI. They are the only switches that turn test:scheduled:prod and test:public into real production form submits or signups (07-contact-us.spec.js:89, forms-submit.spec.ts:21-22, auth-signup.spec.ts:121, signup-onboarding.spec.ts:70).
  - Pass the workflow_dispatch `script` input through env and an allowlist, never `${{ inputs.script }}` inside run:.
  - cron '30 2 * * 0,3' is the same 08:00 IST slot as all 4 local monitors, which would mean a double production crawl and Cloudflare rate-limiting. Offset it.
  - Also touch: `/Users/kulvindersingh/QA-Automations/.gitignore (config/, testpilot-qa-records/, testpilot-device-reports/, TestPilot-HostReady/, **/smoke-reports/)`
- **Verifier (Evidence) — UNSAFE**
  - It misses an existing PRIVATE repo. KulvinderGosal/TestPilot (gh: visibility PRIVATE, last push 2026-08-29) already contains TestPilot/ plus all 8 Playwright framework dirs: ledgerport-saas-automation, ledgerport-shopify, ledgerport-sites, ledgerport-wp-plugin, pushengage-app-dashboard, pushengage-shopify-revamped, pushengage-site, pushengage-wp-plugin. project_testpilot_database.md documents its refresh procedure (rsync with excludes, surgical staging, secret scan, set git identity).
  - So the precondition '0 tracked files… must first be committed' is wrong for that repo, and askUser #2 option (a) should be 'use the existing private KulvinderGosal/TestPilot mirror'. It is missing only packages/qa-core, config/fixtures.json, iam-android/iam-ios and the Oct Phase-1 edits. That also enables a self-hosted Mac runner and reduces the public-repo leak risk.
  - Also touch: `github.com/KulvinderGosal/TestPilot (private mirror; refresh recipe in memory/project_testpilot_database.md)`

### R7 · Make the scheduled monitors an honest, loud signal (and impossible to double-fire)  _(P7, effort M)_

**What:** (1) Spawn scheduler-fired runs under `caffeinate -i -w <childPid>` (server/runner.ts, when the source is the scheduler). (2) Stagger the two Sunday 08:00 jobs (LP 08:00, PE site 10:00) in .testpilot-schedules.json. (3) watchRunForAlert (server/scheduler.ts:149-167) currently stops after 720 ticks (~60 min); make it wait for a terminal status. (4) Since Slack is removed, send every scheduled FAIL/BLOCKED verdict through macNotify (scheduler.ts:376), and have /api/schedule/alert-status return {ready:true, channel:'macos'} for the skill. (5) Triage the reds: aggregate failing test titles over the last 10 scheduled runs per framework, and quarantine known-red and staging-only tests out of test:scheduled:prod in pushengage-site and the LP marketing framework (framework-repo edits, reviewed). Add `,json` to their `--reporter` so local and CI verdicts get per-test counts. (6) Take a pid lock (.testpilot-scheduler.lock) in startScheduler, and change .claude/launch.json 'testpilot-dev' (currently `npm run dev`, autoPort:true) to a url-only attach to http://localhost:5173, so an agent can never start a second scheduler beside the LaunchAgent. (7) Retire the launchd smoke-monitor jobs per askUser #3; unloading a LaunchAgent is persistent config and needs the user's explicit OK at implementation time.

**Why:** The Scheduler is the only heavily used feature, yet 45 of 46 scheduled runs failed and 0 alerts were delivered (SLACK_BOT_TOKEN empty, 'skipped' ×45). The 10-18 LP run took 307.7 min with ~298 min asleep, and PE site started 5 h late behind it. A permanently red, silent monitor is noise. There are three overlapping schedulers today (TestPilot, smoke-all, smoke-auth-ctas).

**Paths:** `server/scheduler.ts`, `server/runner.ts`, `/Users/kulvindersingh/QA-Automations/TestPilot/.testpilot-schedules.json`, `/Users/kulvindersingh/QA-Automations/TestPilot/.claude/launch.json`, `/Users/kulvindersingh/QA-Automations/pushengage-site/package.json`, `/Users/kulvindersingh/QA-Automations/ledgerport-sites/pushengage-ledgerport-site/package.json`, `/Users/kulvindersingh/Library/LaunchAgents/com.awesomemotive.qa.smoke-all.plist`, `/Users/kulvindersingh/Library/LaunchAgents/com.awesomemotive.qa.smoke-auth-ctas.plist`

- **Verifier (Data & safety) — UNSAFE**
  - The pid lock can silently kill the only heavily used feature. startScheduler re-runs inside the SAME process on every Vite in-process restart (globalThis timer guard, scheduler.ts:521-527). A naive 'lock pid alive → don't start' check locks the scheduler out of its own process, and a stale lock plus pid reuse disables every monitor. Treat process.pid as the owner, store the start time, and show 'scheduler disabled: lock held by pid N' in /api/schedule/list. `.testpilot-scheduler.lock` is also not covered by watch.ignored '**/.testpilot-*.json'.
  - Staggering by editing .testpilot-schedules.json gets clobbered: the scheduler holds `schedules` in memory and rewrites the file (scheduler.ts:47-65). The collision is also on BOTH Sunday and Wednesday (4 jobs, all 08:00 on days 0 and 3), not just Sunday. Use the API (delete+create loses lastRun*/blockedOn) or add a cadence-update route.
  - caffeinate -i doesn't stop lid-close sleep (the 10-18 run was asleep ~298 min), so the verdict floor's sleep handling stays essential.
  - Also touch: `vite.config.ts (watch.ignored for the lock file)`

### R8 · Test Cases: visible run output, evidence links, one poller, consistent verdicts  _(P8, effort M)_

**What:** (1) Dock the shared RunPanel in TestCases.tsx while runCase/runCases/runCaseOnDevice is active. (2) Link every TmCase.history[].runId (src/tm/types.ts:137) to /runs/:id. (3) Make trackCaseRun (src/tm/store.ts:1104-1125, the device path) map results through tmStatusFromVerdict, as runOneCase does (:1052-1058). (4) Remove the duplicate full-output polls `fetchRun(rid, 0)` (store.ts:1041, :1108) and read status from the store's incremental poller. (5) Add a runId/generation guard to pollRunnerRun (src/store/useStore.ts:390-444) and reset the module-level runnerOffset per run, so a stale tick can't revive a cleared panel or interleave outputs during bulk runs. (6) The ios mode copies evidence/run-<event>.png into the run detail so Run Story shows it (this unblocks U10). (7) Add a ConfirmDialog before Run selected when runEnv=production; today it is only a banner (TestCases.tsx:263). (8) Re-running Import from frameworks marks imp- cases whose file:line no longer appears in `playwright test --list` as stale (a 'Stale imports' sub-suite). It never deletes, which keeps the ~2.4k imported cases as the user asked.

**Why:** 155 of the last 200 runs were case runs, yet the user complained 9 times (08-05..08-18) about runs 'still executing', 'unexecuted' or skipped. The live output and Run Story evidence can't be reached from where the runs start. There are two pollers per run, and the device path ignores the verdict floor.

**Paths:** `src/screens/tm/TestCases.tsx`, `src/tm/store.ts`, `src/store/useStore.ts`, `src/screens/runner/RunPanel.tsx`, `server/runner.ts`

- **Verifier (Data & safety) — UNSAFE**
  - (8) breaks history continuity. imp- ids are keyed on the line number (`imp-<fw>-<file>-<line>`, store.ts:1723). Any spec edit that shifts lines creates a new id, and 'marks stale + moves to a Stale imports sub-suite' strands lastRunStatus and history on the old copy, taking it out of its curated suite. Instead: match by file+title to carry history forward, tag stale cases rather than move them, and refuse the stale pass if --list errors or more than 20% of a framework's cases would go stale (a config or env project change can list a different subset).
  - (4) removing runOneCase's own fetchRun and reading status from the shared RunPanel poller risks the case never resolving if the panel is cleared or attached to another run. The verdict write-back is lost and runQueue sticks. Keep an independent cheap status poll (offset=999999999, the way run-product.sh does it).
  - (3) is correct and needed. trackCaseRun maps run.status straight to 'passed' (store.ts:1118-1120) without consulting the verdict.

### R9 · Sessions: make blocking actionable instead of permanently red  _(P9, effort S)_

**What:** Count only 'active' personas in SessionBadge and the Products banner: those used by a framework's defaultEnv or by an enabled schedule. Show single-engagement personas (ledgerport-shopify :billingpagetesting-2 and :silverlisting) as 'inactive' in Settings→Sessions; they remain probe-able there. Render each blocking persona's captureCmd (already returned by /api/sessions) as a copyable line in the banner and the badge tooltip. Have the canary's macNotify name the capture command.

**Why:** The canary has read 0 ok / 4 warn / 5 block since 10-12 with no recovery, and every auth-gated framework is gated off. A badge that is always red trains the user to ignore the one honest gate, and two of the five blocks belong to finished engagements.

**Paths:** `server/sessions.ts`, `server/scheduler.ts`, `src/components/layout/SessionBadge.tsx`, `src/screens/TestRunner.tsx (SessionsPanel → Settings)`

- **Verifier (Data & safety) — safe**
  - Inactive personas (ledgerport-shopify :billingpagetesting-2, :silverlisting) must stay registered in personaDefs. personaForRun returns null, meaning an ungated run, for any env without a registered persona (runner.ts:1318). Filter them in the UI only.

### R10 · Bound DB growth and give backups a restore UI  _(P10, effort M)_

**What:** In server/tmStore.ts, replace the count-only MAX_BACKUPS=50 (line 35) with tiered retention: the last 10, plus 1/day for 14 days, plus 1/week for 8 weeks. Store snapshots gzip-compressed (node:zlib), run PRAGMA wal_checkpoint(TRUNCATE) after each write, and run one VACUUM after pruning. Settings→Data lists /api/tm/backups (reason, counts, size) and restores through a ConfirmDialog, using the already-written but never-called listTmBackups/restoreTmBackup (src/lib/tmStore.ts). Require X-TP-Nonce on POST /api/tm/restore, which replaces the whole state.

**Why:** 19 full snapshots take 44.4 MB of the 49.3 MB DB (~90%); the live state is 2.4 MB, and at the cap the file reaches ~120 MB. The backup safety net has no UI, and restore is a destructive route guarded only by Origin.

**Paths:** `server/tmStore.ts`, `server/api.ts`, `src/lib/tmStore.ts`, `src/screens/Settings.tsx (new; Data tab)`

- **Verifier (Dependencies) — safe**
  - Adding the X-TP-Nonce requirement to POST /api/tm/restore means restoreTmBackup (src/lib/tmStore.ts:79) must switch to fetchWithNonce from src/lib/session.ts. The plan says 'wire', not 'add nonce'.
  - Also touch: `src/lib/tmStore.ts:79`
- **Verifier (Data & safety) — UNSAFE**
  - The 19 existing backup rows are plain-text JSON (44.4 MB). If backups move to gzip without reading both formats in restoreBackup, listBackups and counts(), every existing backup becomes unrestorable.
  - Tiered pruning plus VACUUM permanently deletes backups from 08-29 to 09-22. Among them is #10, the only copy of the user's 09-22 deduped 2908-case state. Prune only after R1's sqlite .backup has been verified restorable, and keep snapshots with named reasons (anything other than save/hydrate-reconcile).
  - A nonce on /api/tm/restore is fine, but document it: curl can still get GET /api/session/nonce.

### R11 · Bound runner state files and keep history  _(P11, effort M)_

**What:** Add a total-bytes cap (e.g. 25 MB) alongside MAX_DETAIL_FILES=60 (server/runner.ts:801). Store screenshots as file paths, not inline base64; one detail file is 1.69 MB. Rotate entries past the 200-entry cap (runner.ts:778) into .testpilot-runs-YYYY-MM.json instead of dropping them. Hide self-test runs (tests/__testpilot_v1_no_such__.spec.ts, 2026-10-12) from Runs.

**Why:** Run history is the only usage and evidence record and already lost everything before 2026-08-07. The count-only cap lets single files grow unbounded.

**Paths:** `server/runner.ts`, `src/screens/Reports.tsx (→ Runs)`

- **Verifier (Data & safety) — safe**
  - Screenshot 'file paths' must point to a durable directory, not os.tmpdir() (runner.ts:1485-1487 writes json/png/story there, and macOS purges it). Otherwise Run Story evidence silently disappears.
  - Apply the 25 MB cap only after screenshots move out of the detail files; today 60 files total 4.2 MB, so nothing is purged immediately.

### R12 · Docs, skill and memory refresh to match the 5-screen app  _(P12, effort M)_

**What:** Rewrite CLAUDE.md (681 lines / 54 KB) to about 200 lines covering only what's kept: the 5 screens, the runner + verdict + session gate, the scheduler, the TM store with rev, G3, fixtures, CI (R6). Fix its false claims: per-feature vite plugins (it's server/api.ts now), '8 frameworks, iOS deferred', 'hashless accounts accept any password', the dev 'Bugs' route, Pipelines as the 'primary surface'. Replace the 'Running → launch.json' section with 'reuse the always-on LaunchAgent com.testpilot.dev at :5173'. Update README.md (it still says six frameworks, an Issues screen, TanStack Query). Delete HOSTING.md if U12 lands. Sync .env.example: keep GITHUB_TOKEN; add TP_CI_REPO, TP_CI_WORKFLOW, TP_ALLOWED_HOSTS, QA_FIXTURES_PATH, TP_SESSION_CANARY, TP_CANARY_NOTIFY; drop ASANA_*, SLACK_*, ANTHROPIC_*, SKB_WP_*, GITHUB_REPO. Fix the stale headers in src/tm/store.ts:1-5 and src/tm/types.ts:4-6. Update ~/.claude/skills/testpilot-qa (SKILL.md: alert channel now macOS, CI section; references/frameworks.md: 10 frameworks). Update the memory files that describe removed features: project_checkpoint_qa_cockpit, project_testpilot_tms_rebuild, project_testpilot_asana_routing, project_testpilot_ai_credits, project_testpilot_skb_docs, project_testpilot_database, feedback_qa_lifecycle.

**Why:** CLAUDE.md loads into every session, most of it documents features being deleted, and several of its statements are wrong. Following it today starts a second dev server, which can double-fire the schedules.

**Paths:** `CLAUDE.md`, `README.md`, `HOSTING.md`, `.env.example`, `src/tm/store.ts`, `src/tm/types.ts`, `/Users/kulvindersingh/.claude/skills/testpilot-qa/SKILL.md`, `/Users/kulvindersingh/.claude/skills/testpilot-qa/references/frameworks.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/MEMORY.md`

- **Verifier (Dependencies) — safe**
  - Also update:
  - - docs/QA-PROCESS.md (QA Queue, Author QA plan, QA Log, /runner, /manual) and pushengage-app-dashboard/tests/upgrade-engine/README.md:67.
  - - The testpilot-qa SKILL.md frontmatter ('alert Slack on failure', '8-product fleet') and the run-product.sh timeout text.
  - - Memory files: project_qa_autonomy_phase1.md, project_iam_ios_disp_cluster.md (the Asana-proxy recipe), project_onboarding_revamp_1015.md, project_iam_android_qa.md and project_iam_android_pr34_retest_0c26c6f.md.
  - Also touch: `/Users/kulvindersingh/QA-Automations/docs/QA-PROCESS.md`, `/Users/kulvindersingh/QA-Automations/pushengage-app-dashboard/tests/upgrade-engine/README.md`, `/Users/kulvindersingh/.claude/skills/testpilot-qa/scripts/run-product.sh`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_qa_autonomy_phase1.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_iam_ios_disp_cluster.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_onboarding_revamp_1015.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_iam_android_qa.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_iam_android_pr34_retest_0c26c6f.md`
- **Verifier (Data & safety) — safe**
  - Also fix memory project_testpilot_tms_rebuild.md: its scripted /api/tm/save recipe needs an Origin header now, and baseRev after R5.
  - Also touch: `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_testpilot_tms_rebuild.md`
- **Verifier (Evidence) — UNSAFE**
  - The memory list misses files that describe removed features or are contradicted by the plan: feedback_playwright_runner_first.md (flaky Diagnose + Re-run 5×), project_qa_autonomy_phase1.md (V2a, 4 nonce write routes, ad-hoc target guard), project_testpilot_always_on.md (says connectors/pipelines/reports are live; R7(6) changes launch.json behaviour), and the MEMORY.md index lines for each.
  - The testpilot-qa SKILL.md frontmatter description still says 'whole 8-product fleet… alert Slack on failure', so the trigger text needs updating along with the body sections.
  - Also touch: `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/feedback_playwright_runner_first.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_qa_autonomy_phase1.md`, `/Users/kulvindersingh/.claude/projects/-Users-kulvindersingh-QA-Automations/memory/project_testpilot_always_on.md`

### R13 · Guard GET routes that spawn processes  _(P13, effort S)_

**What:** In requestGuard (server/api.ts), refuse cross-site GETs (Sec-Fetch-Site 'cross-site' or a foreign Origin, the same check the nonce route uses) for /api/runner/specs?refresh=1 (spawns playwright --list for up to 120 s, runner.ts:491) and /api/sessions without cached=1 (spawns npm run auth:probe per stale persona, sessions.ts:233).

**Why:** The Host allowlist only stops DNS rebinding; any page can still trigger these spawns with a plain GET. Low severity on loopback, and a few lines to fix.

**Paths:** `server/api.ts`

- **Verifier (Data & safety) — safe**
  - Compatible: UI fetches send Sec-Fetch-Site: same-origin, and curl from run-product.sh and SKILL.md sends no Origin, so both stay allowed.

## C. Keep

- **The Playwright frameworks and their test cases (8 framework dirs under ~/QA-Automations, the ~2,494 imported imp- automated cases, the @case binding in importFrameworkSpecs)** — This is the user's explicit instruction ('keep the playwright test cases'). The imported cases stay; stale ones are only flagged (R8), never pruned.
- **Runner core: server/runner.ts (spec/smoke/full/command + maestro/ios modes, one-at-a-time spawn, stdout drain, history/detail files), reporters/story-reporter.cjs, src/lib/runner.ts, the useStore runner slice, RunPanel** — Every real run goes through it: 200 runs in history, 155 of them case-tagged, plus 44 device runs. run-product.sh in the testpilot-qa skill depends on /api/runner/frameworks, POST /api/runner/runs and GET /api/runner/runs/:id.
- **V1 honest verdict floor: server/qaLoop/verdict.ts + verdict.test.ts + fixtures/** — It turned the 10-12 '689 failed' into 5 real failures plus 688 infrastructure, it flags host sleep, it is the source of isHonestPass and the CI verdict (R6), and 29/29 tests pass. It encodes the user's rule of never passing by inference.
- **I1 session canary + run gate: server/sessions.ts, src/lib/sessions.ts, SessionBadge, the Test sessions panel (moving to Settings→Sessions)** — Expired auth is the number one blocker, and this is the only honest measure of it. It also stops auth-gated runs from producing false skips or passes.
- **Scheduler: server/scheduler.ts, .testpilot-schedules.json, all /api/schedule* routes including alert-status/test-alert** — It is the only heavily used feature (4 Sun/Wed prod monitors since 2026-07-24), and the testpilot-qa SKILL.md:128-136 calls these routes. It gets fixed (R7), not removed.
- **Run Story (/runs/:id, /api/runner/detail, src/lib/runStory.ts) and run history (/api/reports/history)** — Run Story is the evidence view for every run; run-product.sh falls back to the history route. Both become the Runs screen.
- **TM Test Cases screen + useTm core (suites/cases CRUD, setCaseStatus, runCase/runCases/stopBulkRun, runCaseOnDevice(s), assessIosRun + IAM_IOS_ASSERT, importFrameworkSpecs, cloneSuite/moveCases) and the SQLite store server/tmStore.ts + /api/tm/state|save|backups|restore** — This is where users and Claude record and run cases: 3,060 cases, 152 history entries, 100 curated result cases. Claude sessions write the DB through /api/tm/save. Backup-on-write is the undo.
- **G3 hardening in server/api.ts (Host allowlist, Origin required on writes, the nonce for the remaining POSTs: session probe, TM restore) + vite.config.ts (server.host 'localhost', watch.ignored '**/.testpilot-*.json', the `dev` script the LaunchAgent runs)** — It is cheap and correct, and it is what makes a no-login single-user tool safe. The LaunchAgent depends only on `npm run dev`.
- **Fixtures view (server/fixtures.ts, /api/fixtures, src/lib/fixtures.ts) as Settings→Fixtures** — Read-only and secret-safe (allowlisted fields, assertNoSecrets, 405 on writes). It explains every BLOCKED{FIXTURE} verdict and replaces the stale src/data/stores.ts bookmarks. The minimalist reviewer would delete it; it is kept because it costs little and keeps results explainable.
- **Mobile device harnesses iam-android (maestro) and iam-ios (ios-sim), with their run.sh/run-case.sh and 8/12-minute ceilings** — These are the user's 'mobile SDKs' scope and become the PushEngage Android SDK and iOS SDK Products cards. 61 TM device cases bind to them.
- **GitHub latest-commit read (/api/github/latest-commit) and GITHUB_TOKEN** — About 30 read-only lines that feed the Products cards; the same token powers the new read-only CI status (R6).
- **packages/qa-core (targets guard, BlockedError/parseBlockedMessage, redact, loadFixtures, probe contract)** — TestPilot imports it one-way, and the frameworks use it too. The target guard lives on here for the frameworks after Manual Test/Perf leave TestPilot. Snapshot it in R1, because 0 of its files are tracked.
- **Theme tokens, Modal/ConfirmDialog primitives, @radix-ui/react-dialog and react-popover** — Every kept screen uses them, and dark mode keeps working.

## D. Questions the lead raised

- Login/accounts: TestPilot only listens on localhost and you're the only user. Should I delete the login screen, Users & Team, the Database password unlock and the unfinished server auth / `npm start` path (≈1.3k LOC, plus the stale ~/QA-Automations/TestPilot-HostReady copy)? Or do you still plan to host it for teammates? In that case it stays, I fix the 'Forgot password?' hole (it resets any account from just an email) and add a Users tab under Settings.
- CI home: the root repo KulvinderGosal/QAAutomations is PUBLIC, and most framework folders (app-dashboard, LP SaaS, LP Shopify, qa-core) aren't committed anywhere. Where should the new CI live? (a) A new PRIVATE repo for the 8 Playwright frameworks + qa-core (recommended: it allows a self-hosted Mac runner if Cloudflare blocks GitHub's IPs, and makes staging WP legs possible later). (b) The public root repo, limited to the no-login public suites (PushEngage site, LedgerPort site, LedgerPort SaaS public).
- Can I retire the two launchd smoke-monitor jobs (com.awesomemotive.qa.smoke-all and smoke-auth-ctas) once CI and TestPilot's schedules cover the same sites? They run outside TestPilot without the honest-verdict floor or session gate, and their last report (2026-10-19) was 0/7 passing.

## E. Verifier summaries

### Dependencies

Dependency audit of the 18 removal units and 13 refinements. I grepped TestPilot/src, server, vite.config.ts and package.json, ~/.claude/skills (testpilot-qa), ~/QA-Automations/.claude/skills, the framework package.json files and scripts, packages/qa-core, the LaunchAgents and the memory files. Everything was read-only.

Rule used for `safe`:
- safe=false: following the unit as written breaks something outside TestPilot's own `npm run build` gate (qa-core, a framework script, the always-on LaunchAgent, live state), or breaks the build because of a landing order the plan does not state.
- safe=true: the removal itself is sound and only needs the extra touch-points listed. All of those are mechanical, and most are tsc-detectable because noUnusedLocals is on in both tsconfigs.

Load-bearing problems the plan missed:
1. **U8 package.json line.** TestPilot's `@playwright/test` devDep cannot be removed. packages/qa-core/tsconfig.json maps `@playwright/test` and its typeRoots to `../../TestPilot/node_modules`. qa-core/selftest/types.selftest.ts imports a type from it. The plan's "only if grep finds no other importer" check only searches TestPilot, so it would wrongly clear the removal and break `npm run typecheck|check` in qa-core.
2. **`tsx` is cross-repo load-bearing.** These all run `../TestPilot/node_modules/.bin/tsx`: `auth:probe` in 5 frameworks (spawned by the kept I1 session canary and run gate), `auth:capture:human`, `auth:spike-a`, `spike:b-login`, and the qa-core `selftest` plus probe-fixtures.selftest.ts. Moving tsx to devDependencies (U18) is fine. It must never leave TestPilot along with `start` (U12).
3. **Landing order is unstated and breaks both server and client builds:**
   - U4 (skbDocs imports ./aiTest and github.getPullRequest) and U9 (flaky imports ./aiTest) must land before or with U2 and U3.
   - U5 must land before U2's lib/github trim (tm/store.ts:12 imports `GithubPr`; TestPlans uses fetchPr/listPrs) and before U3 (tm/store.ts:1887 createPlanFromPr uses defaultFrameworkFor).
   - U11 must land with or after U2 (asanaHandler's scrubTask uses intake.scrub).
   - R4 must land before U1 and U13 (seed() at tm/store.ts:568 uses mock `products`).
   - R3 must land before U14 (`/` route).
4. **The LaunchAgent com.testpilot.dev runs `npm run dev` from this same TestPilot folder, and 98%+ of TestPilot is untracked.**
   - A "local branch" does not isolate the work.
   - Every server/*.ts edit restarts Vite and kills any in-flight run.
   - A broken intermediate state makes Vite log "server restart failed" (node_modules/vite chunks/node.js:25770) and keep running the old code silently. A reboot in that state leaves TestPilot down, so the Sun/Wed monitors would not fire.
   - Do the prune in a copy and swap it in when green.
5. **R2 contract tests would mutate live state.**
   - tmStore's DB_PATH is hard-coded to ~/QA-Automations/testpilot-tm.db (server/tmStore.ts:33-34).
   - The schedules, sessions and runs files are cwd-relative (scheduler.ts:43, sessions.ts:494, runner.ts:732).
   - GET /api/sessions without `cached=1` spawns real `auth:probe` processes.
   - Tests need a temp cwd and HOME (or a DB-path override) and must use cached=1.
6. **U15 is mis-framed.** Only smoke-tests.yml is tracked and on origin/main, and it has been workflow_dispatch-only since commit 3f1dca0 (2026-02-23). playwright.yml, qa-publish-reports.yml and the two qa-wp-pushengage-*.yml files are untracked local files that were never pushed. They are not live public leak vectors, but deleting them is unrecoverable, so they must go into the R1 archive.

Missed doc and memory references for R12:
- ~/QA-Automations/docs/QA-PROCESS.md (QA Queue, Author QA plan, QA Log, /runner, /manual).
- pushengage-app-dashboard/tests/upgrade-engine/README.md:67 (/runner).
- Memory files: project_iam_ios_disp_cluster.md documents Claude using /api/asana/tasks|comment|complete-task as its Asana proxy. Also project_onboarding_revamp_1015.md, project_iam_android_qa.md, project_iam_android_pr34_retest_0c26c6f.md and project_qa_autonomy_phase1.md.
- testpilot-qa: the SKILL.md frontmatter ("alert Slack on failure") and the run-product.sh message "Reports → run history".

Kept code that still references retired routes:
- SessionBadge.tsx uses canAccess("/runner") and navigate("/runner").
- RunStory.tsx:197 links to "/reports".
- Scheduler alerts link to `${appUrl}/runs/<id>`. That makes the `/runs/:id` route and the appUrl in vite.config.ts:25 load-bearing; U2 wrongly calls the latter a "Slack link".

If U12 is cancelled: ROUTE_ROLES has no /runs or /settings entry, so canAccess falls back to ROLE_ORDER, which includes dev, and Settings→Data restore would be exposed to the dev role. Database.tsx would also need rewriting, because U1, U2 and U8 delete its data sources (s.tasks, s.issues, s.savedTests).

### Data & safety

Data & Safety verification, read-only (GETs to localhost:5173 and immutable SQLite reads only). The prune is data-safe: every TM collection the plan removes is empty in the live state and in all 19 backups. That covers plans, executions, requirements, risks, releases, defects, perfRuns and deviceRuns, plus 0 externalRef, 0 non-empty requirementIds and 0 comments. Hydration ignores unknown keys, and all seed guards equal their code versions. Removing U2, U4, U6 and U8 deletes every real external write and every user-URL outbound path, which is a safety gain. G3 is untouched: requestGuard is mounted separately from auth, and nonces are checked per handler.

Most important finding: the hydrate-reconcile in src/tm/store.ts:1271 has already reverted user data. On 2026-09-22 at 16:41 the user's 'dedupe-iam-dashboard (final)' removed 52 imp- cases and suite imp-suite-pushengage-app-dashboard-in-app-campaigns (backup 9→10, 2960→2908). The 16:48:58 hydrate-reconcile wrote a stale 2960-case mirror back, and all 52 are in the live DB now. So U13's seedcase prune is unsafe until R5 removes the reconcile and old tabs are reloaded.

Other unsafe items:
- **R2:** the contract tests would hit the hard-coded live DB and the cwd-relative .testpilot-* files. A test-created schedule would later fire against production.
- **R5:** restores of small backups get refused, bulk-run verdicts can be lost, and a failed push during a restart is silently dropped.
- **R6:** a BLOCKED leg exits 0, so the CI chip shows success and can switch off the local monitor. The JSON output path isn't expanded, so the verdict file goes missing. Several untracked dirs are not gitignored (config/fixtures.json, testpilot-qa-records, testpilot-device-reports, HostReady, smoke-reports). Artifacts on a public repo are readable by any signed-in user. CI must never set the prod form/signup switches.
- **R7:** a pid lock would break the scheduler on Vite's in-process restarts, and hand-edits to .testpilot-schedules.json are clobbered. The 08:00 collision is on both Sunday and Wednesday.
- **R8:** stale-marking line-keyed imp- ids strands case history.
- **R10:** gzip would make legacy backups unrestorable, and pruning deletes backup #10, the only deduped snapshot.
- **R1:** the snapshot leaves out run history, Run Story details, schedules and sessions, plus the untracked items being deleted.

Evidence corrections:
- **U15:** 4 of the 5 workflows were never committed (0 commits, untracked), so the claimed public leaks never happened. Deleting them is permanent, so archive them first.
- **U12:** HostReady is an untracked plain dir, not a git repo, and holds a unique SAAS_PLAN.md. Archive it unconditionally.

### Evidence

Evidence-lens verdict: 13 of the 18 removal units hold up, but 4 removal units and 3 refine units need changes before implementation. Method: memory files, the testpilot-qa skill, the run history (200 entries), GET /api/tm/state, gh read-only queries, and transcripts searched with grep -l only (timestamp-anchored patterns on human-origin prompts and on assistant Bash calls).

**Unsafe as planned:**
- **U2 (task/connector cockpit):** its path list includes vite.config.ts:25, which is the startSchedulerWithAlerts call that starts the scheduler ticker and the session canary. Deleting it would silently stop the 4 Sun/Wed monitors and the canary. It also drops the Slack monitor alerts the user asked for in July (documented in feedback_qa_lifecycle.md and in the testpilot-qa skill). Claude still used the /api/asana/comment proxy in October; the Asana MCP can replace it, but the memory's screenshot-upload recipe still needs the TestPilot/.env token. No unit actually implements the qaLog export that dataImpact promises.
- **U7 (local Pipelines):** this is a sequencing problem. Pipelines is TestPilot's only CI/CD surface, and the user explicitly said "keep in mind the CI/CD pipeline". Its replacement (R6) waits on askUser #2 and on committing the frameworks, covers only 3 public legs, and by design never covers the auth-gated or mobile suites. Delete it only after R6 is live, or fold its stage orchestration into Schedules & CI.
- **U12 (login/users/hosting):** strong, recent evidence that the user wants TestPilot hosted for a team: August prompts about hosting, sharing and login, HOSTING.md (08-17), SAAS_PLAN.md (08-26), server-side auth finished 10-12, and a Linux VPS purchase planned (project_testpilot_database.md). The askUser default should be KEEP. TestPilot-HostReady is entirely untracked and holds unique code (scrypt auth, an optimistic-concurrency TM store), so it must always be archived, not only "if anything is uncommitted".
- **U16 (pushengage-android-sdk entry):** it is the only core Android SDK automation in the registry: 7 Maestro flows for subscribe, permission, unsubscribe, segments and attributes. Removing it without folding those flows into the Android card contradicts the user's "mobile SDKs" scope.

**Factual corrections:**
- **U15 (root workflows):** only smoke-tests.yml is tracked, and it is manual-trigger only. The other 4 workflows were never pushed and GitHub Pages is off, so the leak risk is hypothetical. playwright.yml belongs to an 08-15 npm-init scaffold, and the root playwright.config.ts and PlaywrightTests/ that came with it still exist. Untracked files can't be deleted "on a branch"; archive them first.
- **R6 (CI):** it overlooks an existing private repo, KulvinderGosal/TestPilot, which already holds TestPilot and all 8 framework dirs. It should be the default CI home and should be named in askUser #2.

**Missing from refine units:**
- **R1 (snapshot):** its `.testpilot-*.json` exclusion drops schedules.json and runs.json; it also misses HostReady, the workflows and the launchd plists.
- **R12 (memory refresh):** misses feedback_playwright_runner_first.md, project_qa_autonomy_phase1.md and project_testpilot_always_on.md.

**Approved earlier, removable now:** some units remove features the user explicitly asked for but never used: Performance (09-21, "MaxoPerf"), the lifecycle modules (Sep), SKB Docs (Aug), and V2a Asana intake (approved 10-12, just before the rock 1.4 pilot due Oct 23). These are removable under the new direction, but the summary to the user should list them by name.

**Unconfirmed:** with grep -l only, prompt contents weren't readable, so the reliance evidence rests on keyword matches by month.


## F. Thesis (lead)

After this pass TestPilot is a single-user, loopback-only tool for running and tracking automated tests across the 10 product surfaces: PushEngage (marketing site, app dashboard, WP plugin, Shopify app, Android SDK, iOS SDK) and LedgerPort (marketing site, SaaS dashboard, WP plugin, Shopify app). The nav drops from 22 visible items to 5. (1) Products, at '/'. One card per surface, driven by the server framework registry. Each card shows the last honest verdict, the session state with a copyable capture command, the latest master commit and the CI conclusion, and has one Run control: Smoke, Full, one spec, one npm script, or a Maestro/iOS flow. The shared RunPanel sits below. (2) Test Cases. The ~2.5k imported Playwright cases plus the mobile and manual cases; run one, a selection, or on a device; each history row links to its Run Story. (3) Runs. Run history and the Run Story evidence view. (4) Schedules & CI. Local monitors that stay awake and notify on failure, plus read-only GitHub Actions status per product. (5) Settings, with three tabs: Sessions, Fixtures, and Data (TM backups and restore). The parts that make results trustworthy stay and get hardened: the runner, the V1 verdict floor, the I1 session gate and canary, the scheduler, the G3 guards, and the SQLite TM store, which gets conflict-safe writes. The rest is deleted, not hidden: the simulated cockpit and its mock data; the Asana/GitHub/Slack task queue and its write-backs; all in-app AI; SKB Docs; the TestCollab Plans/Runs/Requirements/Traceability/Releases/Defects/Risks modules; Performance; local Pipelines; Manual Test; Asana intake; the 10 seed source files; and, if you confirm, login/users/hosting. That is about 20k of the ~34.5k src+server lines, about 35% of the 1.07 MB bundle, and about 12 npm packages. CI becomes real through one matrix workflow that runs each framework's own scripts, applies the same verdict floor, uploads artifacts and is linked from TestPilot. Auth-gated and mobile suites stay on the local runner behind the session gate. Because the root repo (KulvinderGosal/QAAutomations) is PUBLIC and most framework folders are not committed, the CI change is delivered as a reviewed local branch and is never pushed automatically.
