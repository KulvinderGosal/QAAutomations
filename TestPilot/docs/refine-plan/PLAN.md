# TestPilot Refine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn TestPilot into a 5-screen tool (Products · Test Cases · Runs · Schedules & CI · Settings). Keep every real test path, fix the data-loss and fake-verdict bugs, and prepare a CI workflow for review.

**Architecture:** All work happens in an APFS clone, `~/QA-Automations/TestPilot-next`, served on :5174 against a DB copy, with the scheduler and canary off. Removal units land in AUDIT §6 order, each followed by the full check suite. When everything is green, the copy is rsynced into the live folder (state files, `.env`, `.auth` and `node_modules` stay) and the LaunchAgent restarts.

**Tech Stack:** React 19 + TS + Vite + Tailwind v4 + Zustand; Vite dev-middleware server (`server/api.ts`); `node:sqlite`; `node:test` via `tsx`; Playwright; GitHub Actions.

**Spec:** `docs/refine-plan/SPEC.md` (decisions D1–D6). Unit paths and verifier notes are in `docs/refine-plan/AUDIT.md` Appendix A/B. Read both before starting any task.

## Global Constraints

- Work only in `~/QA-Automations/TestPilot-next` (written `NEXT` below) until Task 30. The only exceptions in the live `~/QA-Automations/TestPilot` (`LIVE`) are `docs/refine-plan/*` and `.claude/launch.json` (Task 2).
- **Never** git push, post to Asana/GitHub/Slack, print `.env` values or tokens, type passwords/OTPs, or unload a LaunchAgent without the user's OK at that moment.
- **Never commit to the user's repos.** Per-task checkpoints use a throwaway git repo inside NEXT only (Task 2). It is never pushed and is deleted after the swap. rsync excludes its `.git`.
- **Keep:**
  - devDeps `tsx` and `@playwright/test`;
  - `startSchedulerWithAlerts` (vite.config.ts:25);
  - registry framework ids and persona ids `<fw>:<env>[:<name>]`;
  - suite productIds `pe-site, pe-app-dashboard, pe-shopify, pe-wp-plugin, lp-dashboard, lp-wp-plugin, lp-shopify, lp-site, pe-android-sdk, pe-ios-sdk`.
- **No real test runs from NEXT** while LIVE has a run in flight (`curl -s localhost:5173/api/runner/frameworks | jq .activeRunId` must be `null`), and never within ±2 h of Sun/Wed 08:00 IST.
- **Before deleting any file**, it must already be in the Task 1 archive. Tasks only delete files listed in their unit's AUDIT path list or named in the task.
- **New UI** uses the token utilities (`text-ink-1`, `bg-surface-2`, `border-border`, …) and the primitives in `src/components/ui/`. No raw `oklch()`.
- **zustand:** never return a fresh array/object from a selector. Select raw slices and derive in render.

## Shared definitions

**CHECKS**: run in NEXT after every task. The task is not done until every command exits 0.

```bash
cd ~/QA-Automations/TestPilot-next
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run lint            # 0 errors, 0 warnings from Task 3 on
npm test                # aggregate from Task 3 on (before that: npm run test:verdict && npm run test:intake)
npm run build
```

**SWEEP**: run after every task that touches `src/`.
1. Start or reuse the preview `testpilot-next`, at `http://localhost:5174`.
2. If no session exists, run `localStorage.setItem('testpilot.session','u-kulvinder')` in the tab and reload. This is the admin seed id; never type a password.
3. Load every route that is currently routed (the task names any changes) and `read_console_messages` with `onlyErrors`. **Expected: 0 errors per route.**

**CHECKPOINT**: `cd NEXT && git add -A && git commit -qm "<task id>: <title>"` in the throwaway repo.

## Review Focus

1. **A stale tab still running the OLD bundle after the swap** posts `/api/tm/save` without `baseRev`. The server must refuse it (428 `base-rev-required`) and never overwrite. *Test: Task 5, contract test `save without baseRev → 428`.*
2. **The server restarts mid "Run selected"** (Vite restart, 149 logged). No per-case verdict write-back may be lost, and `runQueue` must not stick. *Test: Task 5, `saveQueue` unit test "offline then online replays every verdict op in order".*
3. **Old bookmarks** (`/runner`, `/queue/task-3`, `/tests/plans`, `/reports`, `/database`) must land on a sensible new screen, never a blank page. *Test: Task 13, `legacyRedirect` unit test.*
4. **The registry fetch fails during Import from frameworks.** Nothing is written and no `suite-fw-*` root appears. *Test: Task 19, `planImportRefresh(null registry) → refused`.*
5. **Restoring one of the 19 existing plain-JSON backups after gzip retention lands** must restore its exact case count. *Test: Task 25, contract test "legacy plain backup restores".*

---

## Phase A — Safety net

### Task 1: Archive everything before any change (R1)

**Files:**
- Create: `~/QA-Automations/_archive/testpilot-2026-10-20/` (gitignored by root `.gitignore:35`)

**Interfaces:**
- Produces: `ARCHIVE=~/QA-Automations/_archive/testpilot-2026-10-20`. It contains `src.tgz`, `state/`, `testpilot-tm.db.backup`, `tm-state.json`, `MANIFEST.txt`.

- [ ] **Step 1:** Create `$ARCHIVE/src.tgz` from `TestPilot/` (exclude `node_modules`, `dist`, `.env`, `.auth`), `packages/qa-core/`, `config/`, `.github/workflows/`, `TestPilot-HostReady/` (exclude `node_modules`, `dist`), `testpilot-device-reports/`, and `~/Library/LaunchAgents/com.testpilot.dev.plist`, `com.awesomemotive.qa.smoke-all.plist`, `com.awesomemotive.qa.smoke-auth-ctas.plist`.
- [ ] **Step 2:** `cp LIVE/.testpilot-*.json $ARCHIVE/state/`.
- [ ] **Step 3:** `sqlite3 ~/QA-Automations/testpilot-tm.db ".backup '$ARCHIVE/testpilot-tm.db.backup'"`, then `curl -s localhost:5173/api/tm/state > $ARCHIVE/tm-state.json`.
- [ ] **Step 4: Verify.**
  - `sqlite3 $ARCHIVE/testpilot-tm.db.backup "select count(*) from tm_state_backup; select json_array_length(json,'$.cases') from tm_state;"` → **19** and **3060** (±the live count in `tm-state.json`; record the exact numbers in `MANIFEST.txt`).
  - `tar tzf $ARCHIVE/src.tgz | wc -l` > 0.
  - `ls $ARCHIVE/state | wc -l` ≥ 60.
- [ ] **Step 5:** Write `MANIFEST.txt`: the file counts, the DB counts and the date.

### Task 2: Working copy with isolated DB and no scheduler

**Files:**
- Create: `NEXT` (`cp -c -R LIVE NEXT`); `NEXT/.env` (copy of live + 4 lines); throwaway `NEXT/.git`
- Modify: `NEXT/server/tmStore.ts:33-34`, `NEXT/server/api.ts` (`mountAll`, `tmHandler`, `startSchedulerWithAlerts`, `scheduleHandler`), `NEXT/server/scheduler.ts:524-530`
- Modify: `LIVE/.claude/launch.json` (add a config; no restart, not a server file)

**Interfaces:**
- Produces:
  - `configureTmStore(opts: { dbPath?: string }): void`: must be called before the first `db()`; if the DB is already open at another path, it closes and reopens it.
  - `tmDbPath(): string`: default `~/QA-Automations/testpilot-tm.db`.
  - `startScheduler(opts?: { tick?: boolean }): void`: always loads the schedules. With `tick:false` it clears any timer and does not start the canary.
  - `GET /api/schedule/list` adds `scheduler: { ticking: boolean }`.
  - `GET /api/tm/state` adds `db: string`, the basename of `tmDbPath()`.

- [ ] **Step 1:** `cp -c -R ~/QA-Automations/TestPilot ~/QA-Automations/TestPilot-next`. In NEXT, delete `.testpilot-schedules.json` and `.testpilot-sessions.json` (copies of live state), so NEXT never holds live jobs. Then copy `$ARCHIVE/state/.testpilot-schedules.json` back in, so Schedules has data to show; the ticker stays off.
- [ ] **Step 2:** `sqlite3 $ARCHIVE/testpilot-tm.db.backup ".backup '$ARCHIVE/testpilot-tm.next.db'"`. Append to `NEXT/.env`: `TP_TM_DB=<abs path of testpilot-tm.next.db>`, `TP_SCHEDULER=0`, `TP_SESSION_CANARY=0`, `TP_CANARY_NOTIFY=0`.
- [ ] **Step 3:** Implement `configureTmStore` and `tmDbPath`. `mountAll` calls `configureTmStore({ dbPath: env.TP_TM_DB })` before mounting `tmHandler`. `startSchedulerWithAlerts` calls `startScheduler({ tick: env.TP_SCHEDULER !== '0' })`. With `tick:false`, `startScheduler` loads the schedules but never calls `startSessionCanary()`, so no canary timers are armed.
- [ ] **Step 4:** Add to `LIVE/.claude/launch.json`: `{"name":"testpilot-next","runtimeExecutable":"bash","runtimeArgs":["-lc","cd /Users/kulvindersingh/QA-Automations/TestPilot-next && PORT=5174 exec npm run dev"],"port":5174}`.
- [ ] **Step 5:** `cd NEXT && git init -q && printf 'node_modules\ndist\n.env\n.auth\n.testpilot-*.json\n' > .git/info/exclude && git add -A && git commit -qm baseline`.
- [ ] **Step 6: Verify.** Start `testpilot-next`.
  - `curl -s localhost:5174/api/tm/state | jq -r .db` → `testpilot-tm.next.db`.
  - `curl -s localhost:5174/api/schedule/list | jq .scheduler.ticking` → `false`.
  - The NEXT preview logs contain no `[canary]` line after 3 min.
  - `curl -s localhost:5173/api/schedule/list | jq '.schedules|length'` → `4` (live untouched).
  - Run CHECKS (pre-Task-3 form), then CHECKPOINT.

### Task 3: Contract tests, server typecheck, unit-test harness (R2)

**Files:**
- Create: `server/test/harness.ts`, `server/test/contract.test.ts`
- Modify: `tsconfig.node.json` (`include`), `tsconfig.app.json` (`exclude: ["src/**/*.test.ts"]`), `package.json` scripts, and every file oxlint warns on

**Interfaces:**
- Produces:
  - `startTestServer(env?: Record<string,string>): Promise<{ base: string; port: number; tmp: string; req(path: string, init?: { method?: string; body?: unknown; headers?: Record<string,string>; origin?: string | null; host?: string }): Promise<{ status: number; json: any }>; close(): Promise<void> }>`.
    - It does `mkdtemp` and `process.chdir(tmp)` **before** dynamically importing `../api.ts`, so the cwd-relative state files land in tmp.
    - It sets `process.env.QA_ROOT=~/QA-Automations` before the import, because `server/runner.ts:36` and `server/fixtures.ts:18` otherwise resolve framework dirs from `cwd/..`.
    - It passes `TP_TM_DB=<tmp>/tm.db`, `TP_SCHEDULER=0`, `TP_SESSION_CANARY=0` and `TP_ALERT_NOTIFY=0`.
    - It calls `startSchedulerWithAlerts(env, base)`, which with `TP_SCHEDULER=0` only loads schedules from tmp.
    - It mounts `mountAll` on `127.0.0.1:0`.
    - `req` defaults: `Host: localhost:<port>`, plus `Origin: http://localhost:<port>` on non-GET (`origin:null` omits it).
  - Scripts:
    - `test:contract` = `node --experimental-sqlite --import tsx --test server/test/contract.test.ts`;
    - `test:unit` = `node --import tsx --test "src/**/*.test.ts" "server/**/*.unit.test.ts"`;
    - `test` = `npm run test:verdict && npm run test:intake && npm run test:contract && npm run test:unit`.
  - `tsconfig.node.json` `include`: `["vite.config.ts","server/**/*.ts","src/**/*.test.ts","scripts/**/*.ts"]`.

- [ ] **Step 1: Write `contract.test.ts`** with these cases. No case may spawn a process.

| Route | Expected |
|---|---|
| `GET /api/runner/frameworks` | `frameworks[]` with `id,label,brand,dir`; `activeRunId` null |
| `GET /api/runner/scripts?framework=pushengage-site` | `scripts[]` with `name,command` |
| `POST /api/runner/runs {framework:"nope",mode:"smoke"}` | 4xx with `error` string |
| `GET /api/runner/runs/run-nope` | 404 with `error` |
| `GET /api/reports/history` | `history` array |
| `GET /api/sessions?cached=1` | `sessions[]`, `blocking` number |
| `GET /api/schedule/list` | `schedules[]`, `scheduler.ticking===false` |
| `POST /api/schedule {framework:"pushengage-site",script:"test:health",cadence:{type:"weekly",day:0,at:"09:00"}}` → toggle → `DELETE` | 201 / 200 / 200, shapes per `scheduler.ts` |
| `GET /api/schedule/alert-status` | `ready` boolean |
| `GET /api/tm/state` on an empty DB | `state:null` |
| `POST /api/tm/save {state:{suites:[],cases:[]},reason:"t"}` → `GET /api/tm/backups` | 200; backups array |
| `Host: evil.test:<port>` | 421 `host-not-allowed` |
| `POST /api/tm/save` with `origin:null` | 403 `origin-required` |
| `POST /api/sessions/x/probe` without a nonce | 403 `bad-nonce` |

- [ ] **Step 2:** Run `npm run test:contract`. Expected: the harness module is missing, so it fails. Then implement `harness.ts`.
- [ ] **Step 3:** Run `npm run test:contract`. **Expected: all pass.** Then `ls ~/QA-Automations/TestPilot-next/.testpilot-schedules.json` must be unchanged (mtime same as before the run).
- [ ] **Step 4:** Apply the tsconfig/script changes and fix the 11 oxlint warnings. Run CHECKS (full form): **0 lint warnings**. CHECKPOINT.

---

## Phase B — Foundations

### Task 4: One product/framework registry (R4)

**Files:**
- Modify: `server/runner.ts` (`RunnerFramework`, all 11 `FRAMEWORKS` entries); `src/tm/store.ts` (`FRAMEWORK_PRODUCT` ~:57, `seed()`, `importFrameworkSpecs` ~:1651-1664); `src/screens/tm/TestCases.tsx` (`TM_FRAMEWORKS` uses at :937, :1143, :1333-1360)
- Create: `src/lib/registry.ts`, `src/lib/registry.test.ts`

**Interfaces:**
- Produces:
  - `type Surface = "marketing-site"|"dashboard"|"saas"|"wp-plugin"|"shopify"|"android-sdk"|"ios-sdk"`.
  - `RunnerFramework` gains `productId: string; surface: Surface; productLabel: string`, returned by `/api/runner/frameworks` (additive).
  - In `src/lib/registry.ts`:
    - `type FrameworkInfo` (the client shape of a `/api/runner/frameworks` entry);
    - `type Product = { productId: string; label: string; brand: "PushEngage"|"LedgerPort"; surface: Surface; frameworks: FrameworkInfo[] }`;
    - `groupProducts(fws: FrameworkInfo[]): Product[]` (pure, stable order = registry order);
    - `fetchRegistry(): Promise<FrameworkInfo[] | null>` (module-cached; `null` on failure).

| framework id | productId | surface | productLabel | label change |
|---|---|---|---|---|
| pushengage-site | pe-site | marketing-site | PushEngage Marketing Site | — |
| pushengage-app-dashboard | pe-app-dashboard | dashboard | PushEngage App Dashboard | — |
| pushengage-wp-plugin | pe-wp-plugin | wp-plugin | PushEngage WP Plugin | — |
| pushengage-shopify-revamped | pe-shopify | shopify | PushEngage Shopify | — |
| pushengage-android-sdk | pe-android-sdk | android-sdk | PushEngage Android SDK | — |
| iam-android | pe-android-sdk | android-sdk | PushEngage Android SDK | → "PushEngage Android SDK (IAM)" |
| iam-ios | pe-ios-sdk | ios-sdk | PushEngage iOS SDK | → "PushEngage iOS SDK" |
| ledgerport-marketing-site | lp-site | marketing-site | LedgerPort Marketing Site | — |
| ledgerport-saas-automation | lp-dashboard | saas | LedgerPort SaaS | — |
| ledgerport-wp-plugin | lp-wp-plugin | wp-plugin | LedgerPort WP Plugin | — |
| ledgerport-shopify | lp-shopify | shopify | LedgerPort Shopify | — |

- [ ] **Step 1:** Write `registry.test.ts`:
  - `groupProducts` on the 11 rows gives **10** products;
  - `pe-android-sdk.frameworks.map(f=>f.id)` deep-equals `["pushengage-android-sdk","iam-android"]`;
  - every productId is in the Global Constraints set.

  Add to the contract test: every `/api/runner/frameworks` entry has `productId`, `surface` and `productLabel`.
- [ ] **Step 2:** Run `npm run test:unit && npm run test:contract`. Expected: FAIL (module/fields missing).
- [ ] **Step 3:** Implement the server fields and `registry.ts`. Switch `importFrameworkSpecs` and the TestCases framework list to `fetchRegistry()`, keeping only frameworks with `kind` undefined/`"playwright"` for import. `seed()` becomes `seed(products: Product[])`, called from `hydrate()` after `fetchRegistry()`. Delete `FRAMEWORK_PRODUCT`. Leave `TM_FRAMEWORKS` (Task 8 deletes it), `PRODUCT_FRAMEWORK` (Task 9) and mock `products` (Task 11).
- [ ] **Step 4:** Run CHECKS, then SWEEP (`/tests`, `/runner`). Confirm that "Import from frameworks" lists the 8 Playwright frameworks. **Do not click it.** CHECKPOINT.

### Task 5: TM write integrity — rev, 409, no reconcile, retry queue (R5)

**Files:**
- Modify: `server/tmStore.ts` (schema migration, `loadState`, `saveState`, `restoreBackup`); `server/api.ts` (`tmHandler`); `src/lib/tmStore.ts`; `src/tm/store.ts` (`load`/`save`/`pushToServer`/`persist`/`hydrate` at :676-760, :903-926, :1234-1280); `src/components/layout/Header.tsx`
- Create: `src/tm/saveQueue.ts`, `src/tm/saveQueue.test.ts`

**Interfaces:**
- **Server:**
  - `loadState(): { json: string; rev: number } | null`.
  - `saveState(json: string, reason: string, opts: { baseRev?: number; force?: boolean }): SaveOk | SaveRefusal`, where:
    - `SaveOk = { ok: true; rev: number; savedAt: string; cases: number; suites: number; backedUp: boolean }`;
    - `SaveRefusal = { ok: false; status: 409|422|428; code: "conflict"|"mass-drop"|"base-rev-required"|"bad-force"; rev: number; message: string }`.
  - **Rules:**
    - No `baseRev` and no `force` → 428.
    - `force` is allowed only when `reason` starts with `script:`, `prune:` or `restore-`, else 428 `bad-force`.
    - `baseRev !== rev` → 409.
    - `prev.cases > 20 && next.cases < prev.cases*0.1` without a `prune:`/`restore-` reason → 422 `mass-drop`.
    - Success → `rev+1`.
    - Empty table: rev = 0.
  - **Migration:** add `rev INTEGER NOT NULL DEFAULT 0` when `PRAGMA table_info(tm_state)` lacks it. It is idempotent and runs on first `db()`.
  - **API:** `GET /api/tm/state` returns `rev`. `POST /api/tm/save {state, reason, baseRev?, force?}` maps a refusal to its status with `{error,code,rev}`.
  - `restoreBackup` calls `saveState(json, "restore-<id>", {force:true})`.
- **Client `src/lib/tmStore.ts`:**
  - `fetchTmState()` returns `{state,cases,suites,rev}|null`.
  - `saveTmState(state, reason, baseRev): Promise<{rev:number; warning?: string}>` throws `TmSaveError { status: number; code: string; rev?: number }` for 409/422/428 and `Error` on a network or 5xx failure.
- **`src/tm/saveQueue.ts`:**

  ```ts
  type Reapply = (server: Persisted) => Persisted;
  type SaveQueueDeps = {
    save(state: Persisted, reason: string, baseRev: number): Promise<{ rev: number }>;
    fetchState(): Promise<{ state: Persisted; rev: number } | null>;
    onOffline(down: boolean): void;
    onConflict(server: Persisted, rev: number): void;
    onSaved(rev: number): void;
    retryDelaysMs?: number[];
  };
  export function createSaveQueue(deps: SaveQueueDeps, initialRev: number): {
    push(snapshot: Persisted, reapply?: Reapply): void;
    flush(): Promise<void>;
    readonly rev: number;
  };
  ```

  - `push` debounces 200 ms and saves the latest snapshot.
  - On a network error: `onOffline(true)`, retry with delays default `[1000,2000,5000,10000,30000]` (then repeat 30000), keeping every pending `reapply` in order.
  - On 409, or on recovery from offline: `fetchState()`. If every pending op has a `reapply`, fold them over the server state and save with the server rev. Otherwise call `onConflict(server, rev)` and drop the queue.
- **`useTm`:**
  - adds `rehydrate(): Promise<void>` (hydrate ignoring `hydrated`) and `readOnly: boolean` (true while `serverDown`);
  - user mutations are refused with a toast while `readOnly`;
  - verdict write-backs (`runOneCase`/`trackCaseRun`) always `push(snapshot, reapply)`, where `reapply` patches only that case's `lastRunStatus`/`runs`/`history`.
- **Header:** when `serverDown`, show the banner "DB offline — retrying. Edits are paused; run results will save when it's back."

- [ ] **Step 1: Write the failing tests.**
  - `saveQueue.test.ts`:
    - "409 with reapply saves reapplied state at server rev";
    - "409 without reapply calls onConflict and does not save";
    - "network fail ×2 then ok → onOffline(true) then onOffline(false), saved once";
    - **"offline then online replays every verdict op in order"** (3 reapply ops patching cases a, b, c → the final saved state has all three).
  - Contract tests:
    - "save without baseRev → 428";
    - "stale baseRev → 409 with rev";
    - "mass drop 100→5 with reason `save` → 422; with `prune:x` + force → 200";
    - "restore of a backup → 200 and rev increments".
- [ ] **Step 2:** Run `npm run test:unit && npm run test:contract`. Expected: FAIL.
- [ ] **Step 3:** Implement the server and the client lib.
- [ ] **Step 4: Rewrite `hydrate`:**
  - fetch the registry + state;
  - `null` → `serverDown`/`readOnly`, retry hydrate every 5 s;
  - `state:null` → `seed(products)` saved with `baseRev 0`, reason `seed`;
  - else set the state as-is, with **no reconcile save**.
  - Delete `load()`, `save()` and every localStorage read/write of `testpilot.tm`. Leave the key itself in place.
- [ ] **Step 5:** Run CHECKS. SWEEP `/tests`: a suite rename persists after a reload. Stop the NEXT preview → the banner appears and a rename is refused with a toast. Restart → the banner clears. CHECKPOINT.

---

## Phase C — Removals (AUDIT landing order)

For each removal task:
1. Add a contract assertion that the retired API family returns 404 (or that the route no longer exists).
2. Run it (FAIL).
3. Delete exactly the unit's AUDIT path list plus its "Also touch" lines.
4. `grep -rn` each deleted module name across `src/ server/ vite.config.ts` → **0 hits**.
5. CHECKS, SWEEP, CHECKPOINT.

### Task 6: U4 SKB Docs
- **Delete:** AUDIT U4 paths (`server/skbDocs.ts`, `skbHandler` + its mount, `src/screens/SkbDocs.tsx`, `src/lib/skbDocs.ts`, the `/skb-docs` route + nav item + `ROUTE_ROLES` key, the `SKB_WP_*` reads).
- **404 assertions:** `GET /api/skb/status`, `POST /api/skb/create`.

### Task 7: U9 Reports extras
- **Delete:** `server/reports.ts` (smoke list/read), `server/flaky.ts`, `server/flakyPitfalls.ts`, `flakyHandler`, the `/api/reports/smoke*` routes, `src/lib/flaky.ts`, and the Reports sections builder / smoke index / Verified & closed / Flaky.
- **Keep:** the `/api/reports/history` handler and the Reports history table (Task 16 moves it).
- **404 assertions:** `/api/reports/smoke`, `/api/flaky/list`.

### Task 8: U5 TestCollab modules
- **Delete:** the AUDIT U5 paths (the 7 screens, their store slices/actions, the types, the Dashboard quality-metrics row, `TM_FRAMEWORKS`) and the routes `/tests/plans|runs|requirements|traceability|releases|defects|risks`.
- **Persisted:** drop `plans`, `executions`, `requirements`, `risks`, `releases`, `defects` (0 rows each; archived).
- **Unit test (`src/tm/normalize.test.ts`):** `normalize()` of a blob that has these keys returns an object without them, with the same `cases.length`.

### Task 9: U3 in-app AI layer
- **Delete:** the AUDIT U3 paths, plus `mapPriority`/`scenarioToSteps`/the `Priority, TestScenario` imports (`src/tm/store.ts:13,772-781`), `PRODUCT_FRAMEWORK`/`defaultFrameworkFor`, and the CopilotModal.
- **Deps:** `npm uninstall @anthropic-ai/sdk exceljs`.
- **404 assertions:** `/api/ai/status`, `/api/qa/plan`.
- **Check:** `grep -rn "anthropic\|exceljs" src server package.json` → only the `.env.example` comment (Task 27 removes it).

### Task 10: U2 + U11 cockpit, connectors, Asana intake (together)

**Files:**
- Delete: the AUDIT U2 + U11 paths
- Create: `server/slackPost.ts` (moved `postMessage`)
- Modify: `server/scheduler.ts:15,125,263`, `server/github.ts`, `server/api.ts`, `src/lib/github.ts:5`, `src/App.tsx`, `src/store/useStore.ts`

**Interfaces:**
- Produces:
  - `postSlackMessage(token: string, channel: string, text: string): Promise<{ channel: string }>`, the same behaviour as the old `postMessage`.
  - `server/github.ts` keeps only `latestCommit` and its types.
  - `src/lib/github.ts` keeps only `fetchLatestCommit`.

- [ ] **Step 1:** Contract: 404 for `/api/asana/me`, `/api/github/issues`, `/api/slack/messages`, `POST /api/tm/import/asana/1`. `GET /api/schedule/alert-status` still returns `ready` boolean. `GET /api/session/nonce` still 200.
- [ ] **Step 2:** Delete everything listed above. Move `postMessage` into `slackPost.ts`. In `scheduler.ts`, import `postSlackMessage`. Drop the 4 Asana/GitHub routes from the nonce write list. Remove `loadAsana`/`loadGithub`/`loadSlack` and the connector `useEffect` from `App.tsx`.
- [ ] **Step 3:** Remove `npm run test:intake` from the `test` script and delete `server/qaLoop/intake*.ts`.
- [ ] **Step 4:** Apply the removal recipe (steps 4–5). SWEEP routes: `/`, `/tests`, `/runner`, `/schedule`, `/reports`, `/runs/<any id from history>`.

### Task 11: U1 simulated cockpit, mock data, bell
- **Delete:** the AUDIT U1 paths, `src/components/icons/AsanaLogo.tsx`, `SlackLogo.tsx`, `src/lib/product.ts`, `src/components/ProductChip.tsx`, `src/components/ui/DemoBadge.tsx`, and the useStore `products` slice (`useStore.ts:121,523`).
- **Trim, don't delete:** `src/lib/tone.ts` (drop the `QA_STAGE`/`ISSUE_STATE`/`OWNERSHIP`/`TASK_STATUS`/`PRIORITY` tone maps and keep `BRAND_TONE` + `Tone`).
- **AppShell:** remove `closeNotif` (`AppShell.tsx:11,31`).
- **Header:** bell, notifications and search go.
- **Check:** `grep -rn "data/mock" src` → 0.

### Task 12: U13 seed sources and backfills (code only)

**Files:**
- Delete: the 10 `src/tm/*Seed.ts` files
- Create: `src/tm/iosAssert.ts` (move `IAM_IOS_ASSERT` + `IosAssert` from `iamIosSeed.ts:133-149`)
- Modify: `src/tm/store.ts` (remove build*/backfill* :96-302, :326-676, the chain at :698, `*_SEED_VERSION`, `seedcase-1..4` in `seed()`; `normalizeAndBackfill` → `normalize`)

- [ ] **Step 1:** Unit test (`normalize.test.ts`): `normalize(p).cases.length === p.cases.length` for a blob missing every seed id (no additions), and `seed(groupProducts(rows)).suites.length === 10`, with 0 cases.
- [ ] **Step 2:** Implement. **No DB prune here**; the DB prune is in Task 30.
- [ ] **Step 3:** CHECKS. SWEEP `/tests`: the case count in the UI equals `curl -s localhost:5174/api/tm/state | jq '.cases'`. Then "Run on device" on an IAM iOS case shows its button (don't run it). CHECKPOINT.

---

## Phase D — The new information architecture

### Task 13: Shell — routes, nav, header, roles, login fix (R3 + D1)

**Files:**
- Modify: `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/SessionBadge.tsx:17,45`, `src/lib/users.ts:128-150`, `src/screens/Login.tsx:56-75` (+ the reset-mode UI)
- Create: `src/lib/routes.ts`, `src/lib/routes.test.ts`

**Interfaces:**
- **`legacyRedirect(pathname: string): string | null`:**

  | Old path | Redirects to |
  |---|---|
  | `/runner`, `/overview`, `/queue`, `/queue/*`, `/manual`, `/skb-docs`, `/integrations`, `/qa-log` | `/` |
  | `/reports` | `/runs` |
  | `/pipelines` | `/schedule` |
  | `/fixtures` | `/settings?tab=fixtures` |
  | `/users` | `/settings?tab=users` |
  | `/database` | `/settings?tab=data` |
  | `/tests/<anything>` | `/tests` |
  | any of the 5 live routes (or `/runs/:id`) | `null` |

- **`ROUTE_ROLES`:** `{"/":[admin,qa,dev], "/tests":[admin,qa,dev], "/runs":[admin,qa,dev], "/schedule":[admin,qa], "/settings":[admin,qa]}`. `canAccess` normalizes `/runs/:id` → `/runs` and returns **false** for an unknown path (no `ROLE_ORDER` fallback).

- [ ] **Step 1: Unit tests.** Every row of the redirect table. `canAccess("/settings","dev")===false`, `canAccess("/runs/run-1","dev")===true`, `canAccess("/nope","admin")===false`.
- [ ] **Step 2:** Run `npm run test:unit`. Expected: FAIL.
- [ ] **Step 3: Implement the shell.**
  - Routes: `/` → `<TestRunner/>` (temporary until Task 17), `/tests`, `/runs` → `<Reports/>` (temporary until Task 16), `/runs/:id`, `/schedule`, `/settings` → a placeholder "Settings" page (Task 15). A catch-all element applies `legacyRedirect` (else `/`).
  - Sidebar: exactly 5 items (Products, Test Cases, Runs, Schedules & CI, Settings) plus the user/sign-out footer.
  - Header: CRUMBS for the 5 routes; brand toggle; SessionBadge → `canAccess('/settings')` + `navigate('/settings?tab=sessions')`.
  - Login: delete `reset()` and the reset mode. Replace the "Forgot password?" link with the text "Forgot your password? Ask an admin to reset it in Settings → Users."
- [ ] **Step 4:** CHECKS. SWEEP: the 5 routes plus `/runner`, `/queue/task-3`, `/tests/plans`, `/reports` and `/database`, each landing per the table. The sidebar shows 5 items. CHECKPOINT.

### Task 14: Sessions — active personas + GET spawn guards (R9 + R13)

**Files:**
- Modify: `server/sessions.ts` (`sessionsView`), `server/runner.ts`, `server/api.ts` (`requestGuard`, `sessionsHandler`), `server/scheduler.ts` (canary notification text)
- Create: `server/sessions.unit.test.ts`

**Interfaces:**
- `activePersonaIds(schedules: { framework: string; script: string; env: string | null; enabled: boolean }[]): Set<string>` in `runner.ts`. It is the default persona of every framework's `defaultEnv`, plus `personaForRun(fw, {framework, mode:"command", script, env})` of every enabled schedule.
- `sessionsView({ cachedOnly, active }: { cachedOnly: boolean; active: Set<string> })` adds `active: boolean` to every session. `blocking` and `warnings` count active personas only.
- The canary notification body names each blocking persona's `captureCmd`.
- `requestGuard` refuses with 403 `{code:"cross-site"}` a GET to `/api/runner/specs?refresh=1`, or to `/api/sessions` without `cached=1`, when `Sec-Fetch-Site: cross-site` or a foreign `Origin` is present. A request with neither header (curl) passes.

- [ ] **Step 1: Write the tests.**
  - Unit: with no schedules, `ledgerport-shopify:billingpagetesting-2` and `ledgerport-shopify:silverlisting` are **not** active, and `pushengage-site:production` (if a persona) or `ledgerport-shopify:staging` **is** active.
  - Contract:
    - `/api/sessions?cached=1` entries have `active`;
    - cross-site GET `/api/sessions` → 403;
    - same GET with `cached=1` → 200;
    - `/api/runner/specs?framework=pushengage-site&refresh=1` with `Sec-Fetch-Site: cross-site` → 403.
- [ ] **Step 2:** Run the tests and see them FAIL, implement, then see them PASS. CHECKS. CHECKPOINT.

### Task 15: Settings screen (Sessions · Fixtures · Data · Users)

**Files:**
- Create: `src/screens/Settings.tsx`, `src/screens/settings/SessionsTab.tsx` (moved `SessionsPanel` + `SessionRow` from `TestRunner.tsx:271-448`), `FixturesTab.tsx` (body of `src/screens/Fixtures.tsx`), `DataTab.tsx`, `UsersTab.tsx` (body of `src/screens/Users.tsx`)
- Delete: `src/screens/Fixtures.tsx`, `src/screens/Users.tsx`, `src/screens/Database.tsx`
- Modify: `src/lib/tmStore.ts:79` (`restoreTmBackup` → `fetchWithNonce`); `server/api.ts` (`tmHandler` restore requires `hasValidNonce`)

**Interfaces:**
- Consumes: `rehydrate()` (Task 5); `active` (Task 14).
- The tab comes from `?tab=sessions|fixtures|data|users` (default `sessions`). Users and Data are rendered only for `admin`.
- **SessionsTab:** inactive personas (`active:false`) render with an "inactive" badge below the active ones, and stay re-probe-able.
- **DataTab:**
  - a backups table (id, reason, cases, suites, saved at);
  - **Restore** → ConfirmDialog ("Replace the current test-case data with backup #N (X cases)? The current state is backed up first.") → `restoreTmBackup` → `rehydrate()`;
  - **Export current state** downloads `testpilot-tm-<date>.json` from `/api/tm/state`;
  - **Export legacy QA Log & saved tests** appears only when localStorage `testpilot.qaLog` or `testpilot.savedTests` is non-empty. It downloads `testpilot-legacy-<date>.json` `{qaLog, savedTests}` and shows both counts.
- **UsersTab:** the old Users screen plus a **Reset password** action per user (admin only). It sets a new hash via `makePasswordHash`, entered by the admin in a password field. The agent never fills it.

- [ ] **Step 1:** Contract: `POST /api/tm/restore {id}` without a nonce → 403 `bad-nonce`; with a nonce → 200.
- [ ] **Step 2:** FAIL → implement → PASS. Route `/settings` → `<Settings/>`.
- [ ] **Step 3:** CHECKS. SWEEP `/settings` with each tab. In the 5174 tab, `localStorage.setItem('testpilot.qaLog','[{"id":"x"}]')` → the export button shows "1 QA Log entry". Do **not** click Restore. CHECKPOINT.

### Task 16: Runs screen

**Files:**
- Create: `src/screens/Runs.tsx`, `src/lib/runSource.ts`, `src/lib/runSource.test.ts`
- Delete: `src/screens/Reports.tsx`, `src/lib/reports.ts` (move `fetchRunHistory` to `src/lib/runner.ts`)
- Modify: `server/runner.ts` (`RunRequest.source`, `RunHistoryEntry.source`, `recordHistory`), `server/scheduler.ts` `fireDue` (`source:"scheduled"`), `src/tm/store.ts` `runOneCase`/`runCaseOnDevice` (`source:"case"`), `src/screens/RunStory.tsx:197` (link → `/runs`)

**Interfaces:**
- `type RunSource = "manual"|"scheduled"|"case"`. `RunRequest.source?: RunSource`, stored on the history entry.
- `runSource(e: RunHistoryEntry): RunSource`:
  1. `e.source` if set;
  2. else `"case"` when `e.taskRef?.label` marks a TM case run (match the label prefix `runOneCase` writes today: read it in `src/tm/store.ts`);
  3. else `"scheduled"` when `e.mode==="command"` and the label contains `test:scheduled`;
  4. else `"manual"`.
- `isSelfTest(e)`: `e.label` includes `__testpilot_`. These rows are hidden.
- The table shows product (from the registry), framework, label, verdict chip (`verdictNote`), source, started and duration. Filters: product, verdict state, source. The brand toggle filters by product brand. A row opens `/runs/:id`.

- [ ] **Step 1:** Unit tests for each `runSource` branch (one fixture each, taken from real `.testpilot-runs.json` shapes) and for `isSelfTest`.
- [ ] **Step 2:** FAIL → implement → PASS. Route `/runs` → `<Runs/>`.
- [ ] **Step 3:** CHECKS. SWEEP `/runs` (rows from the copied history appear) and a row → `/runs/:id`. CHECKPOINT.

### Task 17: Products screen

**Files:**
- Create: `src/screens/Products.tsx`, `src/screens/products/ProductCard.tsx`, `src/screens/products/RunControl.tsx`, `src/screens/products/runRequest.ts`, `src/screens/products/runRequest.test.ts`
- Delete: `src/screens/TestRunner.tsx` (its FrameworkCard/SpecTree logic moves into ProductCard/RunControl)

**Interfaces:**
- Consumes: `groupProducts`/`fetchRegistry` (Task 4); `active` sessions (Task 14); `fetchRunHistory` (Task 16); `/api/schedule/list`; `fetchLatestCommit`; the shared `RunPanel` + useStore `attachRunnerRun`.
- **`type RunChoice`:**
  - `{ kind: "smoke" | "full" }`;
  - `{ kind: "spec"; spec: string }`;
  - `{ kind: "script"; script: string }`;
  - `{ kind: "flow"; script?: string; spec?: string }`.

  All of them also carry `framework: string; env?: string; headed?: boolean`.
- **`buildRunRequest(c: RunChoice, fw: FrameworkInfo): RunRequest`:**
  - smoke/full → mode smoke/full;
  - spec → mode spec;
  - script → mode command;
  - flow → mode command (maestro scripts) or mode `ios` (iam-ios, spec = event);
  - always `source:"manual"`;
  - **never sets `sessionGate`**.
- `needsProdConfirm(c: RunChoice): boolean` is true when `env === "production"`, or when env is unset and the framework's `defaultEnv === "production"`.
- **Card:** label + brand; the last verdict (the newest history entry of any of its frameworks, `verdictNote`); a persona chip per framework default persona (ok/warn/block + a Copy capture cmd button); the next fire (min `nextRunAt` of enabled schedules on its frameworks); the latest commit; the RunControl.
  - A framework picker shows when there are 2+ frameworks.
  - Modes by `kind`: playwright → Smoke · Full · Spec… · Script…; maestro → Flow… (npm scripts) · Script…; ios-sim → Flow… (spec input).
  - An env select from `envOptions` and a headed checkbox.
  - Production → ConfirmDialog "Run against PRODUCTION (<label>)?".
- **Top banner** (only when any active persona blocks): "N sessions need you", one line each: persona · human action · copyable capture cmd.
- **The brand toggle** filters the cards. `RunPanel` is docked at the bottom.

- [ ] **Step 1: Unit tests.**
  - `buildRunRequest` per kind, asserting `!("sessionGate" in req)` and `req.source==="manual"`.
  - `needsProdConfirm`: `{framework:"pushengage-site", env:undefined}` with `defaultEnv:"production"` → true; `env:"staging"` → false.
- [ ] **Step 2:** FAIL → implement → PASS. Route `/` → `<Products/>`.
- [ ] **Step 3:** CHECKS. SWEEP `/`:
  - **10 cards** under All, 6 under PushEngage, 4 under LedgerPort;
  - choosing production on the PE site card opens the confirm (Cancel it);
  - the Android card shows a framework picker with both frameworks.

  No run. CHECKPOINT.

### Task 18: U14 TM Dashboard, Donut, activity feed
- **Delete:** `src/screens/tm/Dashboard.tsx`, `src/components/charts/Donut.tsx`, `logActivity` and its callers, and the `activity` slice. Drop `activity` from Persisted; the 53 entries are archived.
- **Unit test (`normalize.test.ts`):** a blob with `activity` normalizes without it.
- **Check:** `grep -rn "dangerouslySetInnerHTML" src` → 0.

### Task 19: Test Cases refinements (R8)

**Files:**
- Modify: `src/screens/tm/TestCases.tsx` (remove the Asana import button, comments/review UI, plan/requirement fields, `DeviceRunReports` :601/:1395); `src/tm/store.ts` (`runOneCase` :1041, `trackCaseRun` :1104-1125, `importFrameworkSpecs`); `src/store/useStore.ts` `pollRunnerRun` (:390-444); `server/runner.ts` ios mode (copy `evidence/run-<event>.png` into the run detail)
- Create: `src/tm/importPlan.ts`, `src/tm/importPlan.test.ts`

**Interfaces:**
- `tmStatusFromVerdict` (existing) is used by both `runOneCase` and `trackCaseRun`.
- Each case run gets its own status poll at `offset=999999999`; the duplicate `fetchRun(rid, 0)` calls are removed.
- `pollRunnerRun` takes a run id. A module-level `pollGen` counter is captured per call, so a tick whose gen ≠ the current gen exits without touching state. `runnerOffset` resets to 0 per new run id.
- **`planImportRefresh(existing: TmCase[], listed: RunnerSpec[] | null, fw: FrameworkInfo | null): { refused: string } | { upserts: TmCase[]; staleIds: string[] }`:**
  - `fw` or `listed` null → `{refused:"registry or --list unavailable"}`.
  - Match existing `imp-*` cases of `fw` by `(file, title)` first, then by id. A matched case keeps id/history/lastRunStatus/suite and gets `specFile:"file:line"` updated.
  - Unmatched existing cases → `staleIds` (tagged `stale`, never moved or deleted).
  - `staleIds.length > 0.2 * existingForFw` → `{refused:"would mark N of M cases stale (>20%)"}`.
- **UI:**
  - default filter Automated, with an "All" toggle;
  - the header brand toggle filters the suite tree to product suites of that brand (via the registry);
  - a status-count strip (passed/failed/blocked/skipped/never run over the visible cases);
  - the docked RunPanel while any case run is active;
  - history rows link to `/runs/:id`;
  - **Run selected** with `runEnv==="production"` → ConfirmDialog.

- [ ] **Step 1:** Unit tests (`importPlan.test.ts`):
  - "line shift keeps history" (same file+title, line 10→14 → same id, history kept, specFile updated);
  - "removed test is tagged stale, not deleted";
  - **"null registry → refused"**;
  - "--list error (listed null) → refused";
  - "3 of 10 missing → refused >20%".
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Real run, one case (gate: Global Constraints).** In NEXT `/tests`, run one `ledgerport-saas-automation` **public** case (`tests/public/…`).
  - The RunPanel docks and streams.
  - The case `lastRunStatus` matches the run's verdict.
  - The history row opens `/runs/<id>`.
- [ ] **Step 4:** CHECKS. SWEEP `/tests`. CHECKPOINT.

### Task 20: Remaining removals — U6 Performance, U8 Manual Test, U10 device-run store, U18 dead code
- **U6:** the AUDIT U6 paths. Drop `perfRuns`/`startPerfRun`/`deletePerfRun`, `server/perf.ts`, `perfHandler`, `src/lib/perf.ts`.
- **U8:** `src/screens/ManualTest.tsx`; `adhoc/` (TestPilot's adhoc smoke/api specs + config); `startAdhocRun`/`adhocHealth`/`adhocTargetChecks` and `/api/runner/adhoc`; `adhoc` in the `/api/runner/frameworks` response; the `testpilot.savedTests` reader (the Task 15 export keeps reading the raw key). **Keep** `packages/qa-core/guards/*` and `@playwright/test`.
- **U10:** `server/deviceReports.ts`, `devrunHandler`, `src/lib/deviceReports.ts`, `deviceRuns` (+Persisted).
- **U18:** the AUDIT U18 list. Remove exports with 0 importers (`grep -rn "<name>"` across `src server` = definition only) and deps with 0 imports (check each with `grep -rn "from '<dep>'\|from \"<dep>\"" src server`). **Never** remove `tsx`, `@playwright/test` or `express` (U12 is kept).
- **404 assertions:** `/api/perf/run`, `/api/runner/adhoc`, `/api/devrun/list`. `/api/runner/frameworks` has no `adhoc` key.

---

## Phase E — Schedules & CI

### Task 21: `ci-verdict.ts` — the same verdict floor in CI

**Files:**
- Create: `scripts/ci-verdict.ts`, `scripts/ci-verdict.unit.test.ts` (fixtures from `server/qaLoop/fixtures/`)
- Modify: `package.json` (`test:unit` glob also covers `scripts/**/*.unit.test.ts`)

**Interfaces:**
- `ciVerdict(jsonText: string | null): Verdict`: uses `factsFromJsonReport` + `deriveVerdict`. For `null`, empty or unparseable input it returns `{state:"BLOCKED", cls:"HARNESS", code:"no-results", reason:"Playwright JSON results missing or empty", …}`. **Never PASS.**
- `annotation(v: Verdict): string` returns `::notice title=TP_VERDICT::` + the JSON `{"state","cls","executed","reason"}`, with `reason` truncated to 200 chars and newlines stripped.
- `summaryMarkdown(leg: string, v: Verdict): string` returns the GitHub step-summary table.
- `exitCodeFor(v: Verdict): 0 | 1`: 1 only for FAIL.
- **CLI:** `node --import tsx scripts/ci-verdict.ts <results.json> --leg <id> [--out verdict.json]`. It writes verdict.json, appends the summary to `$GITHUB_STEP_SUMMARY` when set, prints the annotation (plus `::warning::` on BLOCKED) and exits `exitCodeFor`.

- [ ] **Step 1:** Unit tests:
  - a passing fixture → PASS + exit 0;
  - a failing fixture → FAIL + exit 1;
  - all-skipped → BLOCKED + exit 0;
  - **`null` → BLOCKED{HARNESS}**;
  - `""` → BLOCKED;
  - the annotation is one line and parses as JSON after the prefix.
- [ ] **Step 2:** FAIL → implement → PASS. CHECKS. CHECKPOINT.

### Task 22: Schedules & CI screen + `/api/ci/status` + cadence edit + U7 + U17

**Files:**
- Modify: `server/github.ts` (add `ciStatus`), `server/api.ts` (`/api/ci/status`, `PATCH /api/schedule/:id`), `server/scheduler.ts` (`updateScheduleCadence`), `src/screens/Schedule.tsx`, `src/screens/products/ProductCard.tsx` (CI chip)
- Create: `src/lib/ci.ts`, `server/github.unit.test.ts`
- Delete: `src/screens/Pipelines.tsx`, `src/lib/pipelines.ts`, `server/pipeline.ts`, `pipelineHandler`, and the Scheduler free-form terminal (U17)

**Interfaces:**
- **`type CiLegStatus`:** `{ framework: string; verdictState: VerdictState | null; executed: number | null; conclusion: string | null; startedAt: string; durationSec: number | null; htmlUrl: string }`.
- **`ciStatus(opts: { token: string; repo: string; workflow: string; fetchImpl?: typeof fetch }): Promise<{ legs: CiLegStatus[]; error?: "no-token"|"workflow-not-found"|"github-error" }>`:**
  - `GET /repos/{repo}/actions/workflows/{workflow}/runs?per_page=5` → for each run `/actions/runs/{id}/jobs` → for each job named `qa (<id>)`, `GET /repos/{repo}/check-runs/{job.id}/annotations`;
  - parse the `TP_VERDICT` notice;
  - keep the newest result per framework;
  - cache 5 min.
- **Route:** `GET /api/ci/status` uses `TP_CI_REPO` (default `KulvinderGosal/QAAutomations`), `TP_CI_WORKFLOW` (default `qa-fleet.yml`) and `GITHUB_TOKEN`.
- **`isCiGreen(l: CiLegStatus): boolean`** in `src/lib/ci.ts`: `verdictState === "PASS" && (executed ?? 0) > 0`.
- **`updateScheduleCadence(id: string, cadence: Cadence): Schedule`:** keeps `lastRun*`/`blockedOn`, recomputes `nextRunAt`. The route `PATCH /api/schedule/:id {cadence}` is same-origin gated.
- **Screen "Schedules & CI":**
  - local jobs (list, create, edit cadence, toggle, run now [confirm], delete [confirm], last verdict, blocked-on);
  - a CI panel listing the 3 legs (`pushengage-site`, `ledgerport-marketing-site`, `ledgerport-saas-automation`) with chip, time and GitHub link, or "Workflow not found in <repo> — prepared on branch ci/qa-fleet, not pushed".
- **Products card CI chip:** only for frameworks with a CI leg.

- [ ] **Step 1: Write the tests.**
  - Unit (`fetchImpl` fake):
    - job `qa (pushengage-site)` conclusion success + annotation `{"state":"BLOCKED","executed":0}` → `verdictState BLOCKED`, `isCiGreen` false;
    - annotation PASS executed 12 → green;
    - 404 on the workflow → `error:"workflow-not-found"`.
  - Contract:
    - `PATCH /api/schedule/:id` keeps `lastRunId` and changes `nextRunAt`;
    - `/api/pipeline/list` → 404;
    - `/api/ci/status` with no token → `{error:"no-token"}`.
- [ ] **Step 2:** FAIL → implement → PASS. CHECKS. SWEEP `/schedule` and `/`. CHECKPOINT.

### Task 23: CI workflow on a review branch (public repo, uncommitted)

**Files:**
- Create a worktree: `git -C ~/QA-Automations worktree add ~/QA-Automations/_ci-qa-fleet -b ci/qa-fleet main` (the shared checkout is never switched).
- In the worktree, create: `.github/workflows/qa-fleet.yml`, `pushengage-site/**`, `ledgerport-saas-automation/**`, `TestPilot/server/qaLoop/verdict.ts`, `TestPilot/scripts/ci-verdict.ts`, `packages/qa-core/errors.ts`; append to `.gitignore`
- Create: `NEXT/scripts/publish-scan.ts`, `NEXT/scripts/publish-scan.unit.test.ts`

**Interfaces:**
- **`scanText(file: string, text: string): Finding[]`**, with `Finding = { file: string; line: number; rule: string }`. It never returns the matched text.
  - **Rules:** `gh-token` (`gh[pousr]_\w{30,}`), `github-pat` (`github_pat_\w{40,}`), `slack` (`xox[abpr]-`), `anthropic` (`sk-ant-`), `openai-like` (`sk-[A-Za-z0-9]{32,}`), `shopify` (`shp(at|ss|ca)_[a-f0-9]{32}`), `aws` (`AKIA[0-9A-Z]{16}`), `jwt` (`eyJ[\w-]{10,}\.[\w-]{10,}\.`), `private-key` (`-----BEGIN [A-Z ]*PRIVATE KEY`), `pw-hash` (`[0-9a-f]{24}:[0-9a-f]{64}`), `password-literal` (`(password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{6,}['"]`, case-insensitive, excluding `process.env`), `asana-gid-token` (`\d/\d{16}:[0-9a-f]{32}`), `email` (`@awesomemotive\.com`), `site-id` (`site_?id['"]?\s*[:=]\s*\d{4,}`).
- **CLI:** `node --import tsx scripts/publish-scan.ts <dir>`. It walks git-addable files (respecting `.gitignore`), prints `file:line rule` and exits 1 on any finding.
- **Workflow:** exactly SPEC §6.2:
  - `on: schedule cron '0 7 * * 0,3'` + `workflow_dispatch` (input `leg`: choice of the 3 ids + `all`; input `script` read via `env: SCRIPT_INPUT` and checked against `^(test:scheduled:prod|test:public)$` inside the step);
  - `permissions: contents: read`;
  - matrix `include` of the 3 legs with `fail-fast: false`, `timeout-minutes: 45`, `concurrency: qa-${{ matrix.id }}`;
  - actions pinned by full commit SHA (resolve the current `actions/checkout@v4`, `actions/setup-node@v4` and `actions/upload-artifact@v4` SHAs with `gh api repos/actions/<name>/git/ref/tags/<tag>`, read-only);
  - the LP leg adds a second checkout of `awesomemotive/pushengage-ledgerport-site` into `lp-site/` with `token: ${{ secrets.LP_SITE_READ_TOKEN }}`;
  - run `npm ci` → `npx playwright install --with-deps chromium` → `npm run $SCRIPT -- --reporter=list,json` with `env: CI: "1"`, `PLAYWRIGHT_JSON_OUTPUT_NAME: ${{ runner.temp }}/results.json`;
  - verdict step `if: always()`: `npx --yes tsx@<exact version from NEXT/node_modules/tsx/package.json> $GITHUB_WORKSPACE/TestPilot/scripts/ci-verdict.ts "${{ runner.temp }}/results.json" --leg ${{ matrix.id }} --out "${{ runner.temp }}/verdict.json"`;
  - upload `verdict.json` only, `retention-days: 14`.
- **Never set:** `SUBMIT_FORMS`, `SMOKE_SUBMIT_FORMS`, `ALLOW_PROD_FORM_SUBMIT`, `RUN_MANUAL_OTP`, `SIGNUP_PASSWORD`.

- [ ] **Step 1:** Unit tests for `scanText`: one positive sample per rule (synthetic values, built by string concatenation so the test file itself doesn't trip the scan), plus "`process.env.WP_PASSWORD` is not a finding" and "the result never contains the matched value".
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Create the worktree. rsync `pushengage-site/` and `ledgerport-saas-automation/` into it, excluding `node_modules .env* .auth test-results playwright-report smoke-reports coverage *.db .git`. Copy the 3 TestPilot/qa-core files. Write the workflow and the `.gitignore` additions (SPEC §6.4).
- [ ] **Step 3b (U15):** In the worktree, delete the tracked `.github/workflows/smoke-tests.yml`, which shows in the review diff. Leave the 4 untracked root workflows in the shared checkout untouched. They are archived (Task 1); list them in CI-REVIEW.md for the user to delete.
- [ ] **Step 4:** `node --import tsx NEXT/scripts/publish-scan.ts ~/QA-Automations/_ci-qa-fleet`. **Any finding = STOP**: list `file:line rule` for the user and resolve with them (e.g. move identifiers to env, or exclude the file) before continuing.
- [ ] **Step 5: Local proof of the CI command path** (gate: Global Constraints). Run in `~/QA-Automations/ledgerport-saas-automation`: `CI=1 PLAYWRIGHT_JSON_OUTPUT_NAME=$TMPDIR/r.json npm run test:public -- --reporter=list,json`, then `node --import tsx NEXT/scripts/ci-verdict.ts $TMPDIR/r.json --leg ledgerport-saas-automation`. **Expected:** one `::notice title=TP_VERDICT::` line whose state is PASS / PASS_WITH_GAPS / FAIL / BLOCKED, matching the Playwright summary.
- [ ] **Step 6:** `git -C ~/QA-Automations/_ci-qa-fleet status --short | wc -l`. Write `docs/refine-plan/CI-REVIEW.md`: the file list, the scan result, the secrets to create (`LP_SITE_READ_TOKEN`), what is published, and the push command for the user to run themselves. **No `git add`/commit/push.**

---

## Phase F — Monitors and data hygiene

### Task 24: Honest, loud monitors (R7)

**Files:**
- Modify: `server/runner.ts` (spawn under `caffeinate -i -w <pid>` when `source==="scheduled"` on darwin); `server/scheduler.ts` (`watchRunForAlert` :149-167, `alertStatus`, `sendTestAlert`, `startScheduler` lock); `vite.config.ts` (no change needed; the lock is `.testpilot-scheduler.json`)
- Modify (framework repos, local edits flagged for review): `~/QA-Automations/pushengage-site/package.json` and `~/QA-Automations/ledgerport-sites/pushengage-ledgerport-site/package.json` (`test:scheduled:prod`: `--reporter=list` → `--reporter=list,json`)
- Create: `docs/refine-plan/MONITOR-TRIAGE.md`

**Interfaces:**
- `watchRunForAlert` polls until a terminal status, with no tick cap. On terminal `failed|blocked|error` it sends `macNotify("TestPilot: <SITE_LABEL> <STATE>", "<reason> — <appUrl>/runs/<id>")` via a scheduler-owned notify. `configureAlerts` gains `notify: boolean`, set by `startSchedulerWithAlerts` from `env.TP_ALERT_NOTIFY !== '0'`, independent of `canaryOpts.notify`. It also posts to Slack via `postSlackMessage` when a token is set.
- `alertStatus(): { ready: boolean; channel: string; channels: ("macos"|"slack")[] }`: `ready` is true on darwin (macos) or when a Slack token is set.
- **Lock** `acquireSchedulerLock(file: string, now: number): { owned: boolean; heldBy?: { pid: number; startedAt: string } }`, pure over an injected `fs`/`isAlive`:
  - the owner is `process.pid` + a `startedAt` recorded once per process (`globalThis.__tpSchedStartedAt`);
  - the same pid → owned (a Vite restart re-acquires);
  - a dead pid, or a pid alive but with a different `startedAt` read from `ps -o lstart=` mismatch → take over;
  - otherwise not owned → no ticker, and `/api/schedule/list` `scheduler: {ticking:false, reason:"lock held by pid N"}`.

- [ ] **Step 1: Write the tests.**
  - Unit `server/scheduler.unit.test.ts`:
    - lock: same pid re-acquires;
    - dead pid taken over;
    - live foreign pid → not owned with `heldBy`;
    - `alertStatus` with no token on darwin → `{ready:true, channels:["macos"]}`.
  - Contract: alert-status shape.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Edit the two framework scripts. Write `MONITOR-TRIAGE.md`: from `.testpilot-runs.json` + the detail files, the failing test titles across the last 10 scheduled runs per framework, with counts, each marked real-defect / env (Cloudflare, sleep) / staging-only. **No quarantine.**
- [ ] **Step 4:** CHECKS. CHECKPOINT.

### Task 25: Bounded DB growth (R10)

**Files:**
- Modify: `server/tmStore.ts` (`saveState`, `listBackups`, `restoreBackup`, `counts`, new `pruneBackups`)

**Interfaces:**
- **Compression:** `tm_state_backup` gains `enc TEXT NOT NULL DEFAULT 'plain'` (idempotent migration). New rows are written with `enc='gzip'` and `json` = base64 of `gzipSync(json)`. `readBackupJson(row): string` handles both.
- **`pruneBackups(now: number): { kept: number; deleted: number }`:**
  - keep the newest 10;
  - plus the newest per calendar day for 14 days;
  - plus the newest per ISO week for 8 weeks;
  - plus **every row whose reason is not `pre:save`/`pre:hydrate-reconcile`**;
  - plus id 10 (pinned);
  - delete the rest, then `VACUUM` if `deleted>0`.
- `saveState` calls `pruneBackups` and then runs `PRAGMA wal_checkpoint(TRUNCATE)` after each write. It **does not prune** until `$ARCHIVE/testpilot-tm.db.backup` has been verified (Task 1) — enforced by order, not code.

- [ ] **Step 1:** Contract (temp DB):
  - insert 3 legacy plain backup rows directly via sqlite;
  - **restore of a legacy plain row → `cases` equals its stored count**;
  - 40 saves with reason `save` → `listBackups().length` ≤ 10 + named rows;
  - a row with reason `pre:prune:x` survives;
  - a gzip row restores.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** On the NEXT DB copy: save once via the UI, then `ls -l $ARCHIVE/testpilot-tm.next.db` → much smaller than 49 MB. `/api/tm/backups` still lists id 10. CHECKS. CHECKPOINT.

### Task 26: Bounded run files (R11)

**Files:**
- Modify: `server/runner.ts` (`recordHistory` :778, detail writer :800-801, screenshot handling)

**Interfaces:**
- Screenshots in run details are written to `~/QA-Automations/testpilot-run-evidence/<runId>/<n>.png`. The detail stores `screenshotPath`. `getRunDetail` serves them inline as data-URLs read from disk; when a file is missing it returns `screenshot:null`.
- **Detail cap:** keep `MAX_DETAIL_FILES=60`, plus `MAX_DETAIL_BYTES=25*1024*1024` across `.testpilot-detail-*.json` (oldest deleted first, together with their evidence dir).
- **History:** entries past 200 move to `.testpilot-runs-YYYY-MM.json` (by `startedAt`). `listRunHistory()` reads only the current file.

- [ ] **Step 1:** Unit test `server/runner.unit.test.ts` on the pure helpers: `rotateHistory(list, 200)` → `{ keep, archive: Record<"YYYY-MM", RunHistoryEntry[]> }`, and `capDetails(files: {name,size,mtime}[], 60, 25MB) → names to delete`.
- [ ] **Step 2:** FAIL → implement → PASS. CHECKS. CHECKPOINT.

---

## Phase G — Docs, review, swap

### Task 27: In-repo docs (R12, repo part)
- **Rewrite `CLAUDE.md`** to about 200 lines covering only what's kept:
  - the 5 screens;
  - the registry;
  - runner + verdict floor + session gate/canary;
  - the scheduler, alerts and lock;
  - the TM store with rev/409 (the scripted-save recipe: GET → baseRev → POST with Origin; `force` + `script:`/`prune:`);
  - G3;
  - fixtures;
  - CI (`qa-fleet.yml`, `ci-verdict.ts`, `/api/ci/status`);
  - the copy-and-swap workflow;
  - "reuse the LaunchAgent at :5173, never start a second dev server".
- **Update `README.md`.**
- **`.env.example`:**
  - keep `GITHUB_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_QA_CHANNEL`;
  - add `TP_CI_REPO`, `TP_CI_WORKFLOW`, `TP_ALLOWED_HOSTS`, `QA_FIXTURES_PATH`, `TP_SESSION_CANARY`, `TP_CANARY_NOTIFY`, `TP_ALERT_NOTIFY`, `TP_SCHEDULER`, `TP_TM_DB`;
  - drop `ASANA_*`, `ANTHROPIC_*`, `SKB_WP_*`, `GITHUB_REPO`.
- **Fix the header comments** of `src/tm/store.ts:1-5`, `src/tm/types.ts:4-6` and `vite.config.ts:8-13`.
- **Check:** `grep -n "QA Queue\|Copilot\|Pipelines\|SKB\|Performance\|Manual Test" CLAUDE.md` → 0. CHECKPOINT.

### Task 28: Whole-change code review
- [ ] **Step 1:** Invoke `superpowers:requesting-code-review` over `cd NEXT && git diff baseline..HEAD`, and over the `_ci-qa-fleet` worktree diff. Include SPEC.md and the Review Focus list in the request.
- [ ] **Step 2:** Fix every Critical/Important finding with a test where one applies. Re-run CHECKS + a full SWEEP. CHECKPOINT.

### Task 29: Pre-swap gate
- [ ] **Step 1:** CHECKS (all green), then a full SWEEP of the 5 routes plus all tabs, each with **0 console errors**.
- [ ] **Step 2: A real public smoke from NEXT** (gate: Global Constraints). On the **LedgerPort Marketing Site** card: Script… `test:scheduled:prod`, production confirm. **Expected:** the run ends with a verdict whose `state` is honest for its counts (`executed>0`; PASS / PASS_WITH_GAPS / FAIL with named failures / BLOCKED with a human action, never a PASS with `executed==0`). The run appears in `/runs` and its Run Story opens.
- [ ] **Step 3:** Record the run id, verdict and counts in `docs/refine-plan/PROGRESS.md`. Ask the user for the go-ahead to swap, naming the time window.

### Task 30: Swap into the live folder and post-swap steps
- [ ] **Step 1: Gate.** LIVE `activeRunId` is null, and the time is outside ±2 h of Sun/Wed 08:00 IST. Ask the user to export the QA Log first, either via the new Settings → Data button after the swap (same origin :5173, the key survives) or now via DevTools.
- [ ] **Step 2: Delta archive.** `cp LIVE/.testpilot-*.json $ARCHIVE/state-preswap/`, and `sqlite3 … .backup $ARCHIVE/testpilot-tm.preswap.db`.
- [ ] **Step 3:** `rsync -a --delete --exclude .git --exclude .env --exclude .auth --exclude '.testpilot-*.json' --exclude node_modules --exclude dist --exclude .claude/launch.json NEXT/ LIVE/`. Then `cd LIVE && npm install`.
- [ ] **Step 4:** `launchctl kickstart -k gui/$(id -u)/com.testpilot.dev`, and wait for `curl -s -o /dev/null -w '%{http_code}' localhost:5173/` → 200.
- [ ] **Step 5: Verify.**
  - `curl -s localhost:5173/api/schedule/list | jq '.schedules|length, .scheduler.ticking'` → `4`, `true`;
  - `curl -s localhost:5173/api/tm/state | jq '.rev, .db'` → a number, `testpilot-tm.db`;
  - SWEEP the 5 routes on :5173 (existing session), with 0 console errors;
  - one public smoke (PE site `test:health` or the LP marketing card), with an honest verdict.
- [ ] **Step 6: Stagger** via `PATCH /api/schedule/:id` (with `Origin: http://localhost:5173`): the two `pushengage-site` jobs → `at:"10:00"`, LP stays `08:00`. Confirm with `jq '.schedules[]|{framework,cadence,nextRunAt}'`.
- [ ] **Step 7:** Write `LIVE/.claude/launch.json` `testpilot-dev` as `{"name":"testpilot-dev","url":"http://localhost:5173"}` and remove `testpilot-next`.
- [ ] **Step 8: Ask the user, then retire the old monitors (D3).** `launchctl bootout gui/$(id -u)/com.awesomemotive.qa.smoke-all` and `…smoke-auth-ctas`. Move both plists to `$ARCHIVE/launchagents/`.
- [ ] **Step 9: Ask the user, then run the DB prune (U13), after every old tab has been reloaded.**
  1. GET state + rev.
  2. Remove `seedcase-1..4`, the 52 duplicate `imp-` cases listed in the 09-22 backup diff (backup #9 vs #10 case ids) and suite `imp-suite-pushengage-app-dashboard-in-app-campaigns`.
  3. POST with `{baseRev, force:true, reason:"prune:placeholder-seed-cases+0922-dedupe"}` and `Origin`.
  4. Verify the case count = before − 56.
- [ ] **Step 10:** `rm -rf ~/QA-Automations/TestPilot-next` (its `.git` was throwaway). Delete `$ARCHIVE/testpilot-tm.next.db`. **Rollback recipe** in PROGRESS.md: untar `$ARCHIVE/src.tgz` TestPilot/ over LIVE (same excludes) + `npm install` + kickstart.

### Task 31: Outside-repo docs, skill and memory (R12, remainder)
- **`~/.claude/skills/testpilot-qa/`:**
  - SKILL.md: frontmatter "10 products", alerts = macOS (+ Slack when a token is set), the CI section, `/api/schedule/alert-status` `channels`, and the rev/baseRev note for TM saves;
  - `references/frameworks.md`: the 11 registry entries / 10 products;
  - `scripts/run-product.sh`: "Reports → run history" → "Runs".
- **`~/QA-Automations/docs/QA-PROCESS.md`** and **`pushengage-app-dashboard/tests/upgrade-engine/README.md:67`:** `/runner` → Products, and remove QA Queue / QA Log / Author QA plan.
- **Memory** (update the body + its MEMORY.md line):
  - `project_checkpoint_qa_cockpit`, `project_testpilot_tms_rebuild` (rev/baseRev/Origin recipe), `project_testpilot_asana_routing` (Asana MCP; keep the attachment curl recipe with the `.env` token), `project_testpilot_ai_credits` (AI removed; delete), `project_testpilot_skb_docs` (removed; delete), `project_testpilot_database` (rev, retention, TP_TM_DB);
  - `feedback_qa_lifecycle` (write-back = gh + Asana MCP; alerts macOS), `feedback_playwright_runner_first` (no Diagnose/Re-run 5×), `project_qa_autonomy_phase1` (V2a + nonce routes + ad-hoc removed), `project_testpilot_always_on` (5 screens; launch.json is url-only);
  - `project_iam_ios_disp_cluster`, `project_onboarding_revamp_1015`, `project_iam_android_qa`, `project_iam_android_pr34_retest_0c26c6f` (`/api/asana` proxy → Asana MCP);
  - `project_testpilot_refine_plan` (status: done, archive path, CI branch awaiting review).
- **Final report to the user:** what was removed, the archive path, the swap result + smoke verdict, the CI worktree awaiting review (`CI-REVIEW.md`), `MONITOR-TRIAGE.md`, and what's left.
