# QAAutomations

Playwright (JS, CommonJS) QA framework, mainly for PushEngage: the WordPress plugin, the app dashboard,
the internal dashboard, the onboarding wizard and the marketing site. Also holds LedgerPort suites.

## Keep token usage low
- Never run a whole suite or the default config unless asked. `npx playwright test` with no path matches 3,600+ tests.
- Run the narrowest target: one spec, one `:line`, or `--grep`. Prefer `npm run test:quick -- <path>`.
- Use `npm run test:changed` to run only specs changed against `origin/main`.
- Do not read generated or report files: `test-results/`, `playwright-report/`, `*_REPORT.md`, `*_SUMMARY.md`,
  `EXECUTION_REPORT.md`, `SMOKE_TEST_COMPLETE.md`, `excel-test-data.json`, `node_modules/`.
- Prefer CLI test runs over the Playwright MCP. Use MCP snapshots only to explore a page or confirm a bug once.
- For a small, clearly scoped fix, skip brainstorming and go straight to the fix with a test.

## Suites and configs
| Suite | Folder | Config | Default target |
|---|---|---|---|
| WP plugin regression (critical/high/medium/low) | `tests/pushengage-regression/` | `playwright.config.js` | `WP_ADMIN_URL` (qastaging) |
| WP smoke | `tests/smoke/` | `playwright.config.js` | qastaging |
| App dashboard | `tests/app-dashboard/` | `playwright-app-dashboard.config.js` | `APP_DASHBOARD_URL` |
| PushEngage app | `tests/pushengage-app/` | `playwright-app.config.js` | `APP_DASHBOARD_URL` |
| Onboarding wizard (tags like `@P0`) | `tests/onboarding-wizard/` | `playwright-onboarding.config.js` | staging app dashboard |
| Internal dashboard | `tests/internal-dashboard/` | `playwright-internal-dashboard.config.js` | `INTERNAL_DASHBOARD_URL` |
| Marketing site (production) | `tests/marketing-site/` | `playwright-marketing.config.js` | www.pushengage.com |
| LedgerPort signup | `tests/ledgerport-regression/specs/` | `playwright-ledgerport.config.js` | `LEDGERPORT_BASE_URL` |
| Sign-up, examples | `tests/sign-up/`, `tests/examples/` | `playwright.config.js` | varies |

`playwright.config.js` has `testDir: './tests'`, so with no path it also picks up the other suites' folders.
Always pass a path, or `-c` for the suite's own config.

## Agents (`.claude/agents/`)
Delegate to keep the main context small: `test-runner` (run a target, short summary), `flaky-test-investigator`
(root-cause one failing test), `selector-fixer` (repair locators after UI changes), `coverage-mapper`
(requirements vs existing tests, read-only).

## Shared code
- `tests/utils/config.js`: env-driven settings (`TEST_ENV=local` switches to the local WP site).
- `tests/utils/auth.js`: `loginToWordPress(page)` and other login helpers.
- `tests/utils/pushengage-helpers.js`, `playwright-helpers.js`: page actions. Reuse these before writing new ones.
- `tests/utils/jev-helpers.js`, `claude-helpers.js`: optional AI checks; they skip when API keys are unset.
- `scripts/`: production crawlers and generators (`prod-*.js`, `gen-onboarding-checklist.js`).

## Environment
- Credentials come from `.env` (git-ignored). Copy `.env.example`; never commit real values.
- The `chromium` project uses Google Chrome (`channel: 'chrome'`). In cloud sessions the SessionStart hook
  (`.claude/hooks/session-start.sh`) installs npm deps and Chrome.
- Cloud sessions are blocked by Cloudflare on `qastaging.pushengage.com`, so run live-site suites locally.
- CI (`.github/workflows/smoke-tests.yml`) runs only on manual dispatch.

## Conventions
- Spec files: `NN-description.spec.js`, grouped by feature folder and, in regression, by priority.
- Use `getByRole`/`getByLabel`/text locators before CSS; avoid fixed `waitForTimeout`.
- Never assert `expect(true)`; assert visible UI state or response data.
