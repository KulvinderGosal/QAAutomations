# LedgerPort SaaS — Playwright Automation

End-to-end / regression tests for the LedgerPort SaaS dashboard, covering both
environments:

| Environment | URL | Account |
|-------------|-----|---------|
| **staging** (default) | https://app-staging.ledgerport.com | `LP_EMAIL` in `.env` |
| **production** | https://app.ledgerport.com | `LP_EMAIL` in `.env` |

Pick the target per run with `LP_ENV` (defaults to `staging`).

---

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env      # then fill in credentials (already populated locally)
```

## Authentication (one-time per environment)

The login page is protected by **Cloudflare Turnstile**, which blocks scripted
login. Capture a session once per environment in a real Chrome window; it's
saved to `.auth/<env>.json` and reused until it expires.

```bash
npm run auth:capture        # staging  → .auth/staging.json
npm run auth:capture:prod   # production → .auth/production.json
```

A Chrome window opens at the login page with your email/password pre-filled —
solve the Turnstile checkbox, click **Log in**, and the session saves
automatically when you reach the dashboard.

### Session stays alive automatically

Auth is stored in `localStorage` as a **15-minute access token + 7-day refresh
token**. Before each run, `global-setup` refreshes the access token via the
app's own `POST /api/v1/auth/refresh` endpoint and persists the rotated tokens,
so a captured session keeps working for days without re-capturing — until the
7-day refresh token expires (then re-run `auth:capture`). Keep individual runs
under ~15 minutes; the suite is serial and shares one account session.

## Running tests

```bash
npm test                      # active env (LP_ENV, default staging)
npm run test:staging          # force staging
npm run test:prod             # force production
npm run test:public           # only the public login-page suite (no session)
npm run test:auth             # only the authenticated suite
npm run test:safe             # skip @destructive (data-mutating) tests
npm run test:headed           # headed
npm run test:ui               # Playwright UI mode
npm run report                # open last HTML report
```

### Destructive / data-mutating tests

Tests tagged **`@destructive`** exercise mutating flows (Disconnect, Automap,
Clear Mappings, Push to QuickBooks, Create Business, Invite User, Change Plan).
By default they only open the flow and assert the confirmation UI — they **do
not commit**. To actually perform the mutation (e.g. real QuickBooks pushes):

```bash
LP_RUN_MUTATIONS=1 npm test            # commit mutations on staging
LP_ENV=production npm run test:safe    # production, read-only/safe subset
```

> ⚠️ On **production**, prefer `npm run test:safe` unless you intend to create
> real data. `LP_RUN_MUTATIONS=1` against production will modify live records.

---

## Layout

```
config/env.ts                  Environment resolution (staging | production)
global-setup.ts                Validates/creates the per-env session
scripts/capture-auth.mjs       Manual Turnstile-friendly session capture
tests/
  helpers/
    auth.ts                    login() + session helpers
    app.ts                     routes, sidebar map, locators, mutation guard
  public/
    login.spec.ts              LP-LOGIN-*  (no session)
  authenticated/
    shell.spec.ts              LP-NAV-*    sidebar, account/business, routing
    connections.spec.ts        LP-CONN-*
    mappings.spec.ts           LP-MAP-*
    manual-sync.spec.ts        LP-SYNC-*
    audit-log.spec.ts          LP-AUDIT-*
    manage-account.spec.ts     LP-ACCT-*
    manage-business.spec.ts    LP-BIZ-*
    manage-users.spec.ts       LP-USER-*
    billing.spec.ts            LP-BILL-*
```

## Test inventory

| Area | ID prefix | Screen / route |
|------|-----------|----------------|
| Login | `LP-LOGIN` | `/login` (public) |
| Shell & nav | `LP-NAV` | sidebar, account/business switcher, routing |
| Connections | `LP-CONN` | `/connections` |
| Mappings | `LP-MAP` | `/mappings` (Products / Variations / Customers / Payment Methods) |
| Manual Sync | `LP-SYNC` | `/manual-sync` (Products / Variations / Orders / Customers / Payments) |
| Audit Log | `LP-AUDIT` | `/audit-log` |
| Manage Accounts | `LP-ACCT` | `/manage-account` |
| Manage Businesses | `LP-BIZ` | `/manage-business` |
| Manage Users | `LP-USER` | `/manage-users` |
| Billing | `LP-BILL` | `/billing` |

## Notes

- The app exposes no `data-testid` hooks; locators are built from roles, page
  `<h1>` text, sidebar link hrefs, and the known table column headers.
- `workers: 1` (serial) — the suite shares one account/session, so parallel
  runs would race on shared state.
- Sessions expire; re-run the relevant `auth:capture` command when the
  authenticated suite starts redirecting to `/login`.

## Session canary, API fixture, run ids (QA Autonomy Plan Phase 1)

- `npm run -s auth:probe -- --persona ledgerport-saas-automation:staging [--live]`
  prints ONE token-free JSON line (state, identity email/account/businessId,
  access + refresh expiry) and exits 0 ok / 10 refreshable / 20 human-needed /
  30 harness-error. `--live` adds one read-only `GET /api/v1/me` (staging only).
  Optional expected identity: `.auth/<env>/meta.json` e.g.
  `{"email":"…","account":"202","businessId":"210"}` → mismatch = `wrong-account`.
- `fixtures/qa-api.ts` — `import { test, expect } from '../../fixtures/qa-api'`
  gives a worker-scoped `lpApi` (qa-core) keyed by the project's
  `metadata.persona`. The token is read in-process and never printed; an
  unusable session throws `[BLOCKED:SESSION/…]`.
- `tests/helpers/session.ts` — `readSession()` decodes expiry offline;
  `keepSessionFresh()` is a **no-op until Spike A** (`npm run auth:spike-a`,
  user-started, rotates tokens — see the script header).
- `global-setup.ts` throws `[BLOCKED:SESSION/<code>] … -- human action: npm run auth:capture`
  when no usable session exists and the run includes authenticated projects
  (public-only runs just warn).
- Artifacts go to `test-results/<RUN_ID>` (`RUN_ID`/`QA_RUN_ID` env, else
  generated). Traces/videos are off unless `PW_TRACE=1`; always off for
  login/setup projects.
- Silver Listing D1–D5 carry `@case:SLR-D<n>` tags: `npx playwright test --grep @case:SLR-D3`.
