# PushEngage QA Process Runbook

> A phase-by-phase, tickable QA workflow for the PushEngage plugin + app dashboard.
> Goal: take any change (feature, PR, or release) from **intake → sign-off** the
> same way every time, using this repo's automation, with consistent bug reports
> and a clear release gate.

**How to use this doc**

1. Every change enters at **§1 Intake & Test Planning** — decide scope and risk first.
2. Walk the phases in order (§1 → §6). Each has a checklist ordered by what unblocks
   the most work.
3. Log defects with the **§4** standard so every bug is reproducible and triageable.
4. Nothing ships until **§6 Release Sign-off** passes its exit criteria.

**Priority tiers (used everywhere in this repo):** `P0 Critical` · `P1 High` ·
`P2 Medium` · `P3 Low` — these map directly to the
`tests/…/{critical,high,medium,low}/` folders.

**Legend:** ✅ confirm · 🔧 action · 🔎 where to look · ⚠️ gotcha

---

## QA Lifecycle at a glance

```
Change in (feature / PR / release)
  │
  ├─ §1  Intake & Test Planning ── scope · risk · which suites apply
  │
  ├─ §2  Test Execution ────────── smoke → manual exploratory → automated
  │
  ├─ §3  Run the Automation ─────── this repo: suites, priorities, commands
  │
  ├─ §4  Log Defects ───────────── severity · repro · evidence · template
  │
  ├─ §5  Regression ────────────── priority tiers · coverage map · cross-browser
  │
  └─ §6  Release Sign-off ──────── exit criteria · plan-gated states · record
```

---

## §1 Intake & Test Planning

Do this before writing or running a single test. Ten minutes here saves hours of
re-testing the wrong thing.

- [ ] **Identify the change** — feature / bug fix / PR number / release version.
- [ ] **Read the acceptance criteria / PR description** — know what "done" means.
- [ ] **Map the impacted area(s)** to modules: installation, onboarding, dashboard,
      campaigns (broadcast/drip/triggered/RSS), audience (subscribers/segments/groups/
      attributes), design (popups/widgets/targeting), analytics, settings, WooCommerce,
      WhatsApp/chat, publisher, user management.
- [ ] **Assign a risk level** — touches a core flow (install, opt-in, send) or shared
      code → **high risk** → wider regression. Isolated/cosmetic → **low risk**.
- [ ] **Decide the test scope:** which suites & priority tiers to run (see §3/§5),
      whether new automated coverage is needed, and what needs manual/exploratory eyes.
- [ ] **Confirm the environment & data** — target env (WP staging / app / local),
      test site, plan tier (free vs paid — features are plan-gated), clean vs seeded data.
- [ ] ⚠️ **Note plan-gated behavior** up front — a feature may be intentionally hidden
      on Free; don't log that as a bug.
- [ ] **Write a one-line test plan** in the ticket: *"Areas X/Y, P0+P1 regression +
      manual opt-in check on Chrome/FF, staging, paid plan."*

---

## §2 Test Execution

Order: fastest confidence first, deepest coverage last.

- [ ] **Smoke first.** Run the smoke suite to confirm the build/install is sane before
      spending time on deep tests. 🔧 `npm run test:smoke` (or `:fast`).
- [ ] **Manual / exploratory pass** on the changed area — automation confirms known
      paths; a human finds the unknowns. Try the unhappy paths, empty states, and
      plan-gated boundaries.
- [ ] **Automated targeted run** for the impacted modules (see §3 for exact scripts).
- [ ] **Cross-browser** the critical user paths (Chrome + Firefox + WebKit/Safari).
- [ ] **Verify against acceptance criteria** item by item — not just "tests pass".
- [ ] **Capture evidence as you go** — Playwright auto-captures video + screenshots on
      failure; note repro steps for anything you'll log.
- [ ] ⚠️ **Re-run a failure once** to separate a real defect from a flaky selector/
      timing issue before logging — but never mask a real failure as "flake".
- [ ] **Review the HTML report** before calling the phase done. 🔧 `npm run report`.

---

## §3 Run the Automation (this repo)

Real commands from `package.json` / `run-app-dashboard-tests.sh`. Credentials live in
`.env` — never paste secrets into tickets or reports.

### 3.1 One-time setup

- [ ] `cp .env.example .env` and fill in the required values (WP + app URLs and creds).
- [ ] `npm install`
- [ ] `npx playwright install` (browsers) — this environment pre-installs Chromium.

### 3.2 Smoke (run first, always)

- [ ] `npm run test:smoke` — smoke suite (`tests/smoke/`).
- [ ] `npm run test:smoke:fast` — critical smoke only, parallel (`--workers=5`).
- [ ] `npm run test:wordpress-plugin` — plugin install smoke test.

### 3.3 WordPress plugin regression (~605 cases, P0–P3)

- [ ] `npm run test:regression:critical` — P0 (~245 cases, ~45 min).
- [ ] `npm run test:regression:high` — P1 (~181 cases, ~35 min).
- [ ] `npm run test:regression:medium` / `:low` — P2 / P3.
- [ ] `npm run test:regression:all` — full suite (~605, ~2 h).
- [ ] **Targeted areas:** `:installation` · `:onboarding` · `:dashboard` · `:campaigns`
      · `:broadcasts` · `:drip` · `:triggers` · `:woo` · `:audience` · `:design`
      · `:analytics` · `:settings`.
- [ ] **Faster feedback:** `npm run test:regression:fast` (`--workers=10 --retries=1`)
      or `:parallel` (`--workers=20`).

### 3.4 App dashboard tests (85 cases, 9 modules, P0–P3)

- [ ] `./run-app-dashboard-tests.sh -m critical -h` — critical, headed (recommended first run).
- [ ] `./run-app-dashboard-tests.sh -m <module>` — modules: `login`, `dashboard`,
      `campaign`, `design`, `analytics`, `audience`, `site-settings`, `chat-widgets`,
      `publisher`, `user-management`.
- [ ] `npm run test:app:dashboard` — via Playwright config directly.

### 3.5 Other suites

- [ ] `npm run test:signup` — sign-up flow.
- [ ] `npm run test:broadcast` / `test:send-broadcast` — broadcast send paths.

### 3.6 Reports & artifacts

- [ ] `npm run report` (or `npx playwright show-report`) — HTML report.
- [ ] 🔎 Failure evidence: video + screenshots + trace under `test-results/`.
- [ ] ⚠️ CI: GitHub Actions runs the workflow in `.github/workflows/` — check the run
      before sign-off, don't rely only on local.

---

## §4 Bug Reporting Standards

A bug is only useful if someone else can reproduce it from the report alone.

### 4.1 Severity / priority matrix

| Tier | Meaning | Examples | Ship? |
|---|---|---|---|
| **P0 Critical** | Core flow broken, data loss, or security | Can't install/connect; opt-in fully broken; broadcasts not sending; dashboard won't load | ❌ Blocks release |
| **P1 High** | Major feature broken, no reasonable workaround | Drip/trigger/WooCommerce automation broken; a whole settings tab fails; wrong analytics counts | ❌ Blocks (or triaged sign-off) |
| **P2 Medium** | Feature broken with a workaround, or non-core | Secondary flow glitch; usability defect; edge-case validation | ⚠️ Case-by-case |
| **P3 Low** | Cosmetic / minor | Copy, alignment, tooltip, rare edge case | ✅ Non-blocking |

### 4.2 Every bug report includes

- [ ] **Title** — area + symptom, one line (e.g. *"Opt-in popup not shown on WooCommerce
      product pages — Chrome"*).
- [ ] **Severity / Priority** (P0–P3, per §4.1).
- [ ] **Environment** — WP plugin / app dashboard, version, browser+version, OS, plan tier.
- [ ] **Preconditions** — account/site state, data, plan.
- [ ] **Steps to reproduce** — numbered, from a known start state.
- [ ] **Expected result.**
- [ ] **Actual result.**
- [ ] **Frequency** — always / intermittent (note %).
- [ ] **Evidence** — screenshot / video / console + network / Playwright trace.
- [ ] **Regression?** — did it work in a prior version? name the last-good build.
- [ ] **Related test / spec** — the `*.spec.js` that covers (or should cover) it.

### 4.3 Triage rules

- [ ] **No repro = not actionable** — reproduce (or get a recording) before logging.
- [ ] **One bug per report** — don't bundle unrelated failures.
- [ ] **Search first** — link duplicates instead of re-filing.
- [ ] **P0/P1 → flag immediately**, don't wait for the full run to finish.
- [ ] **Automation gap?** — if a P0/P1 escaped automation, file a follow-up to add a spec.

---

## §5 Regression

Run the right depth for the risk — full regression every time is expensive; too little
lets defects through.

- [ ] **Pick the tier by risk (from §1):**
      - Core/shared change → **P0 + P1** (both plugin & app), plus targeted P2 on the area.
      - Isolated feature → **targeted module** at its tier + a P0 smoke pass.
      - Release candidate → **full P0 + P1**, sampled P2/P3.
- [ ] **Coverage map — plugin (`tests/pushengage-regression/`):** critical (installation,
      onboarding, dashboard, campaigns, push-broadcasts, settings-core) · high (drip,
      triggers, audience, WooCommerce, post editor/types) · medium (design, analytics,
      WhatsApp, goal-tracking, click-to-chat) · low (about, help, ratings, misc).
- [ ] **Coverage map — app (`tests/app-dashboard/`):** login, dashboard, campaign, design,
      analytics, audience, site-settings, chat-widgets, publisher, user-management.
- [ ] **Cross-browser** the P0 paths: Chrome, Firefox, WebKit (`test:chrome/firefox/webkit`).
- [ ] **Plan-gated matrix** — verify free vs paid feature visibility & limits.
- [ ] **Data states** — clean install, seeded/existing data, and limit/quota states.
- [ ] **Compare to the last green run** — investigate every *new* failure; a failure red
      on the prior build too is a known issue, not this change's.
- [ ] ⚠️ **Quarantine ≠ fix** — never skip/disable a failing test to go green; triage it.

---

## §6 Release Sign-off (exit gate)

A release is approved only when all of these hold. Record the result in the release ticket.

- [ ] **Smoke green** on the target build.
- [ ] **P0 regression 100% pass** — plugin AND app dashboard.
- [ ] **P1 regression** pass, or each failure triaged with explicit sign-off.
- [ ] **No open P0 / P1 defects.**
- [ ] **Critical paths cross-browsered** (Chrome + Firefox + Safari/WebKit).
- [ ] **Install + onboarding verified on a clean site** (the first-run experience).
- [ ] **Plan-gated states verified** — free and paid behave as designed.
- [ ] **Core send path verified** — subscribe → broadcast → received.
- [ ] **Analytics/counts sanity-checked** against expected.
- [ ] **CI run green** (GitHub Actions) on the release commit.
- [ ] **Known issues documented** with severity + workaround.
- [ ] **Sign-off recorded** — who, build/version, date, suites run, result.

**Do NOT sign off — escalate instead — when:**
- Any P0 is open or unreproducible-but-reported by multiple sources.
- A regression appears in a core flow (install / opt-in / send) with no root cause.
- CI and local disagree and the discrepancy isn't explained.

---

## Appendix — Reference

**Priority ↔ folder:** `P0`→`critical/` · `P1`→`high/` · `P2`→`medium/` · `P3`→`low/`

**Environments:** WP staging · app (`app.pushengage.com`) · local (`TEST_ENV=local` prefix).
Credentials are in `.env` only — never in tickets, reports, or commits.

**Reports:** `npm run report` → HTML; JSON/JUnit + video/screenshots/trace under
`test-results/`.

**Headline coverage:** ~605 plugin regression cases (P0–P3) + 85 app-dashboard cases
(9 modules, P0–P3).

_Maintained by QA. When a defect escapes automation, add the spec and note it here so the
suite closes the gap._
