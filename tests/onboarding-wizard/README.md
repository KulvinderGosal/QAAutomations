# AI Onboarding Wizard — QA suite

Automated + manual QA for the PushEngage **AI onboarding wizard** rock.

- **FE:** [pushengage-app#1014](https://github.com/awesomemotive/pushengage-app/pull/1014) — the wizard (Web Push / App Push / Chat Widget tracks), resume checklist, and the rebuilt Settings › Installation page.
- **BE:** [pushengage-adonis-node-api#407](https://github.com/awesomemotive/pushengage-adonis-node-api/pull/407) — the `OnboardingAi` module (5 admin-only endpoints), free-plan quotas, SSRF hardening.
- **Environment under test:** `https://staging-app-dashboard2.pushengage.com/`
- **Deploy order:** backend → run the free-plan migration → frontend.

## What's here

| Path | Contents |
|---|---|
| `cases.json` | All **148** plan cases extracted from the QA plan artifact (source of truth). |
| `MANUAL_TEST_CHECKLIST.md` | Full fill-in execution checklist (regenerate with `npm run onboarding:checklist`). Use for the exploratory pass + manual-only cases. |
| `utils/` | `onboarding-config` (env-driven fixtures), `onboarding-auth` (login per account), `onboarding-helpers` (routes, telemetry capture, localStorage snapshot, network watch, sider/site helpers). |
| `entry-routing/` | Groups **B, C** — entry points, routing guards, channel picker, reconfigure. |
| `web-track/` | Groups **D, E, F, G** — install → analyzing → popup → audiences/automations → summary. |
| `chat-track/` | Group **H** — Chat Widget track. |
| `app-track/` | Group **I** — App Push track. |
| `persistence/` | Group **J** — resume card/banner, localStorage persistence, logout sweep. |
| `settings-installation/` | Group **K** — Settings › Installation rebuilt on the wizard bodies. |
| `regressions/` | Group **L** — side effects on existing FE screens. |
| `telemetry-a11y/` | Groups **P, R** — GTM telemetry, responsive/keyboard. |
| `backend/` | Groups **M, N, O** — direct API contracts, plan quotas, shared-module regressions. |

Case totals: **48 P0 · 88 P1 · 12 P2** (115 FE · 33 BE).

## ⛔ Backend prerequisites (confirm before running)

1. **Free-plan migration** run on the backend (`node ace migrate:free_plan_segments`). Without it every free-plan create hits `403 … does not have access` (cases N1/N10).
2. **`GOOGLE_GENERATIVE_AI_API_KEY`** set on the backend. Without it every AI response is a legitimate `fallback: true` with generic content — "AI-curated" assertions can't pass. `fallback: true` is **never** an error.

## Setup

```bash
npm ci
cp .env.example .env          # then fill in the PE_* values (see below)
```

Required env (see `.env.example` for the complete annotated list):

- `APP_DASHBOARD_URL` — defaults to the staging dashboard.
- `PE_ACCOUNT_A_*` (Free admin), `PE_ACCOUNT_B_*` (Business+ admin), `PE_SUBUSER_*` (non-admin on B), `PE_SHOPIFY_*`.
- `PE_SITE_1..5_*` — the five site fixtures (installed / uninstalled / foreign-key / http pre- & post-2026-08-05 cutoff).
- `PE_ANDROID_*` / `PE_IOS_*` — mobile credential fixtures for the App Push track.
- `PE_BACKEND_URL` + `PE_ADMIN_TOKEN` (and optional `PE_SUBUSER_TOKEN`) — for the `backend/` API specs.

Paid **account B** can be created via the pricing signup using the shared Stripe test card (`4242 4242 4242 4242`, `12/44`, `123`) already in `utils/config.js` / `onboarding-config.js`.

**Every test `test.skip()`s itself when its required account/site/fixture env is missing**, so a partial `.env` still runs the subset it can.

## Running

```bash
npm run test:onboarding            # whole suite (chromium)
npm run test:onboarding:headed     # watch it drive
npm run test:onboarding:p0         # P0 cases only (grep @P0)
npm run test:onboarding:web        # one track
npm run test:onboarding:chat
npm run test:onboarding:app
npm run test:onboarding:backend    # direct API specs
npm run test:onboarding:report     # open the HTML report
```

Filter by case id or priority with grep, e.g.:

```bash
npx playwright test --config=playwright-onboarding.config.js --project=chromium --grep "D5|E7"
npx playwright test --config=playwright-onboarding.config.js --grep @P0
```

The suite runs **serially** (`workers: 1`) because the wizard writes real account/site
state (segments, popups, workflows, widgets). A `webkit` project exists for the
Safari-only date-parse cases (L2 / D11 / J6).

## Manual walkthrough (Claude / a tester driving the wizard end to end)

`walkthrough/01-manual-walkthrough.spec.js` drives the dashboard like a hands-on
tester: **fresh signup → picker → Web Push track → Chat Widget → App Push →
completion**, in one shared logged-in session. It's a **soft pass** — each case
is attempted, marked Pass/Fail/Blocked with a screenshot, and the run continues
(a tester notes an issue and keeps going). At the end it writes:

```
test-results/onboarding-walkthrough/<run>/report.md    # table: case · status · note · screenshot
test-results/onboarding-walkthrough/<run>/report.json
test-results/onboarding-walkthrough/<run>/<caseId>.png
```

Run it (watch it drive):

```bash
npm run test:onboarding:walkthrough:headed
```

Env overrides: `WALKTHROUGH_PLAN=free|business` (default business — uses the Stripe
test card), `WALKTHROUGH_SIGNUP_URL` (if the register page differs),
`WALKTHROUGH_EMAIL` / `WALKTHROUGH_PASSWORD` (else a unique plus-addressed email
is generated). If signup hits an email-verification wall it records that as
Blocked and falls back to logging into `PE_ACCOUNT_B_*` so the rest of the pass
still runs. Scope: the linearly-reachable happy-path cases across B–I plus an
observed telemetry check; negative/edge/fixture/backend cases stay in the
per-case suite + checklist.

### Running it live from a Claude Code environment

For Claude to perform this walkthrough itself, the environment's network policy
must allow outbound HTTPS to:

- `*.pushengage.com` (dashboard, signup, API) — at minimum `staging-app-dashboard2.pushengage.com` and `staging.pushengage.com`
- `js.stripe.com`, `api.stripe.com`, `m.stripe.com` — the signup card step
- `*.googletagmanager.com` / `www.google-analytics.com` — only if telemetry assertions must see GTM

A default locked-down web environment blocks all of these, so the walkthrough
must run locally or in an environment provisioned with the allowlist above.

## Conventions & honesty about coverage

- One test per plan case; the title carries the **case id** and a **`@P0/@P1/@P2`** tag.
- Selectors prefer role/text built from the plan's exact copy. Anywhere a real
  selector must be confirmed against the running app it's marked `// TODO(selector)`.
- Cases that genuinely can't be automated without the live DOM, or that need
  Redis/DB/shell inspection, a GTM preview, pixel/contrast checks, or manual
  credential uploads, are marked **`test.fixme(...)`** with the steps preserved
  as comments and covered by the manual checklist instead. These are honest
  placeholders — they don't report false green.
- **First run is a calibration pass:** since these were written without seeing
  the live DOM, expect selector mismatches. Run headed, note what differs, and
  the `TODO(selector)` anchors + case ids make the fixes surgical.

Regenerate the checklist after any `cases.json` change: `npm run onboarding:checklist`.
