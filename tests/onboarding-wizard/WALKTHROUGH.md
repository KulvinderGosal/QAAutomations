# Onboarding Wizard — Manual Walkthrough Runbook

How to run the end-to-end "manual tester" pass over the AI onboarding wizard:
fresh signup → picker → Web Push → Chat Widget → App Push → completion, with a
Pass/Fail/Blocked + screenshot recorded for every case it touches.

- **Spec:** `walkthrough/01-manual-walkthrough.spec.js`
- **Recorder:** `utils/walkthrough-recorder.js` (soft checks — it never stops at the first failure)
- **Signup:** `utils/onboarding-signup.js` (fresh account + Stripe test card)
- **Environment under test:** `https://staging-app-dashboard2.pushengage.com/`

---

## 0. Prerequisites (confirm first)

| # | Prereq | Why |
|---|---|---|
| 1 | Backend deployed with **`GOOGLE_GENERATIVE_AI_API_KEY`** set | Without it every AI response is `fallback:true` (generic content). Not a bug, but the "AI-curated" copy/segments/workflows can't be verified. |
| 2 | **Free-plan migration** run (`node ace migrate:free_plan_segments`) | Without it a free account 403s the moment the wizard creates a segment. Only needed if you run `WALKTHROUGH_PLAN=free`. |
| 3 | A dashboard account for the **fallback** path (`PE_ACCOUNT_B_*`) | If fresh signup needs email verification, the run logs into this account so the rest of the pass still runs. |
| 4 | At least **`PE_SITE_1_*`** (a live https site with PushEngage installed) | Drives the install-check "is live" path and platform detection. |

`fallback: true` is **never** an error — the wizard must show usable default content, never an error state.

---

## 1. Run it locally (you watch the bot drive)

```bash
npm ci                                   # once, installs Playwright
cp .env.example .env                     # then edit .env (see §3)
npm run test:onboarding:walkthrough:headed
```

- `:headed` opens a real Chrome window so you can watch each step.
- Drop `:headed` (`npm run test:onboarding:walkthrough`) for a background run.
- The whole pass is one serial session; expect it to take a few minutes.

When it finishes, read the report (§4).

---

## 2. Run it live from a Claude Code environment (Claude drives it)

A default Claude Code web environment blocks all outbound network, so the
walkthrough can't reach staging from it. To have Claude run the pass itself,
start this task in an environment whose **network policy allows**:

- `*.pushengage.com` — at least `staging-app-dashboard2.pushengage.com` and `staging.pushengage.com`
- `js.stripe.com`, `api.stripe.com`, `m.stripe.com` — the signup card step
- `*.googletagmanager.com`, `www.google-analytics.com` — only if telemetry assertions must see GTM

Steps:

1. Create/select a Claude Code environment with the allowlist above
   (docs: code.claude.com/docs → environments / network policy).
2. Set the same env vars from §3 in that environment.
3. Confirm the §0 prereqs.
4. Start this task there and ask Claude to run the walkthrough. Claude will
   launch Chromium, run `npm run test:onboarding:walkthrough`, and hand back the
   report + screenshots.

Verify connectivity in that environment before running:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://staging-app-dashboard2.pushengage.com/
# 200/302 = reachable · 403 = still blocked by the network policy
```

---

## 3. Environment variables

Minimum for the walkthrough (full annotated list in `.env.example`):

```bash
APP_DASHBOARD_URL=https://staging-app-dashboard2.pushengage.com

# Fallback login if fresh signup needs email verification
PE_ACCOUNT_B_EMAIL=...
PE_ACCOUNT_B_PASSWORD=...

# The installed site for the happy-path install check
PE_SITE_1_URL=https://your-installed-site.com
PE_SITE_1_NAME=Your Site
```

Walkthrough-only knobs (optional):

| Var | Default | Effect |
|---|---|---|
| `WALKTHROUGH_PLAN` | `business` | `free` signs up on the free plan (needs prereq #2); `business` uses the Stripe test card `4242 4242 4242 4242`. |
| `WALKTHROUGH_SIGNUP_URL` | `<APP_DASHBOARD_URL>/register` | Point at the real register page if it differs. |
| `WALKTHROUGH_EMAIL` / `WALKTHROUGH_PASSWORD` | auto (unique `kgosal+onb…@awesomemotive.com`) | Force a specific account instead of a fresh one. |

> Keep real credentials in your local `.env` only — it is git-ignored. Never commit them.

---

## 4. Reading the report

After a run:

```
test-results/onboarding-walkthrough/<run>/
  report.md      ← open this: a table of case · priority · status · note · screenshot
  report.json    ← same data, machine-readable
  <caseId>.png   ← full-page screenshot captured at each case
```

`report.md` header shows the tally, e.g. `12 pass · 3 fail · 2 blocked of 17 cases touched`.

| Status | Meaning | What to do |
|---|---|---|
| ✅ pass | The tester's checks held. | Nothing. |
| ❌ fail | A check threw (assertion failed, or a selector/copy didn't match). | Open the case's screenshot. If it's a real product bug, file it against the PR with the case id. If it's a selector/copy mismatch, note it — Claude pins the `TODO(selector)` and re-runs. |
| ⛔ blocked | A precondition was missing (fixture unset, email verification, unreachable step). | The note says why. Supply the fixture/env, or verify the signup email, then re-run. |

The case ids map 1:1 to `cases.json` and `MANUAL_TEST_CHECKLIST.md`, so a failing
walkthrough case points straight at the full plan steps/expected for that case.

---

## 5. Calibration loop (first run)

The walkthrough was written without access to the live DOM, so the **first run
is a calibration pass** — expect selector/copy mismatches, not clean green.

1. Run headed (§1) or live (§2).
2. Send Claude the `report.md` + the screenshots for any ❌/⛔.
3. Claude pins the real selectors at the `TODO(selector)` anchors and re-runs.
4. Repeat until the happy-path spine is green, then extend to the negative/edge
   cases (those live in the per-case suite + `MANUAL_TEST_CHECKLIST.md`).

---

## 6. Scope & what it does *not* cover

The walkthrough covers the linearly-reachable happy-path cases across groups
**B, C, D, E, F, G, H, I** plus an observed telemetry check (P1). It deliberately
does **not** cover:

- Negative/edge paths (blocked requests, foreign-install site, expired cert, corrupt snapshot) → per-case suite (`web-track/`, `entry-routing/`, `persistence/`, …).
- Backend API / quota / migration / SSRF (M, N, O) → `backend/` specs + manual checklist (need shell/DB/Redis access).
- Visual/pixel, contrast, multi-viewport, Safari date-parse (L, R) → manual checklist / `webkit` project.

Together, the walkthrough + per-case suite + `MANUAL_TEST_CHECKLIST.md` cover all 148 cases.
