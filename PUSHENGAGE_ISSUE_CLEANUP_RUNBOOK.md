# PushEngage WordPress Plugin — Issue Cleanup Runbook

> **How to use this file:** Start a **new Claude Code session sourced from
> `awesomemotive/pushengage-wordpress-plugin`** (that org can't be reached from a
> `kulvindergosal`-scoped session, which is why this is a separate runbook).
> Then paste the **"PROMPT TO PASTE"** block below as your first message.
> Everything the new session needs is spelled out — it starts fresh and has no
> memory of the planning we did.

---

## Why a separate session

- The plugin's issues live at `https://github.com/awesomemotive/pushengage-wordpress-plugin/issues`.
- The GitHub MCP server is scoped per session. A session that already has
  `kulvindergosal/*` repos **cannot** cross-tier add an `awesomemotive/*` repo,
  and vice-versa. So issue read/close for the plugin must happen in a session
  whose **initial source** is the plugin repo.
- The Playwright QA suite lives in the **public** repo
  `KulvinderGosal/QAAutomations`. A plugin-repo session can still **clone it
  read-only** over the git proxy (public repos allow anonymous git reads across
  owners) — it just can't push to it. That's all we need: we run its tests, we
  don't modify it.

## Environment facts (confirmed 2026-09-18)

| Thing | Value |
|---|---|
| Plugin issues repo | `awesomemotive/pushengage-wordpress-plugin` |
| QA suite (public, clone read-only) | `https://github.com/KulvinderGosal/QAAutomations` |
| Staging WP admin | `https://qastaging.pushengage.com/admin` |
| App dashboard | `https://app.pushengage.com` |
| Credentials | In `QAAutomations/.env.example` (copy to `.env`) — **do not paste secrets into issues/PRs** |
| Browser | Chromium is pre-installed at `/opt/pw-browsers`; do **not** run `playwright install` |
| Test posture | **Full functional APPROVED** — may create and send test broadcasts/drips on staging. Still: prefix every test artifact title with `QA-CLEANUP` and prefer sending to a QA-only segment if one exists. Never touch production (`app.pushengage.com` real customer data). |
| Closing policy | **Propose a close list for owner (Kulvinder) approval. Do NOT auto-close.** After approval, close with an evidence comment. |
| Issue author to filter on | `KulvinderGosal` ("issues I reported long ago") |

## Test suite map (in `QAAutomations`, run against **staging**)

The npm `test:regression:*` scripts hardcode `TEST_ENV=local`
(`productionautomation.local`). For staging, **run Playwright directly** with
`TEST_ENV=staging` (or export `WP_ADMIN_URL=https://qastaging.pushengage.com/admin`):

```bash
TEST_ENV=staging npx playwright test <spec-path> --project=chromium
```

| Plugin area | Spec folder (under `tests/pushengage-regression/`) |
|---|---|
| Install / activation smoke | `critical/installation/` (`02-plugin-smoke-test.spec.js`) |
| Onboarding | `critical/onboarding/` |
| Dashboard UI + metrics | `critical/dashboard/`, `critical/dashboard-functional/` |
| Push broadcasts (create/content/preview/UTM/audience/draft/test) | `critical/campaigns/` (29 specs) |
| Broadcast analytics | `critical/analytics/01-verify-broadcast-analytics.spec.js` |
| Subscribers / audience | `critical/audience-functional/`, `high/audience/` |
| Settings | `critical/settings-core/`, `critical/settings-functional/`, `critical/settings-excel/` |
| Design (popups/widgets/targeting) | `critical/design-functional/`, `medium/design/` |
| Drip campaigns | `high/drip-campaigns/` |
| Triggered campaigns | `high/triggers/` |
| WooCommerce | `high/woocommerce-core/` |
| Fast smoke (all criticals) | `tests/smoke/critical-smoke.spec.js` |

There is also the **`anthropic-skills:pushengage-qa`** skill (full-plugin
regression coverage of every screen/route/CRUD/settings/plan-gated state) —
invoke it for areas a bug touches that don't have a matching spec above.

---

## PROMPT TO PASTE (into the plugin-repo session)

```
GitHub cleanup — PushEngage WordPress plugin. Verify my old bug reports and
propose which to close. Work in an organized, evidence-based way. Do NOT close
anything without my sign-off.

CONTEXT
- Issues repo (this session's source): awesomemotive/pushengage-wordpress-plugin
- Only review OPEN issues authored by KulvinderGosal, oldest first.
- QA suite is the PUBLIC repo KulvinderGosal/QAAutomations — clone it read-only:
    GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/KulvinderGosal/QAAutomations /home/user/QAAutomations
  then: cd /home/user/QAAutomations && cp .env.example .env && npm ci
  (Chromium is pre-installed at /opt/pw-browsers — do NOT run `playwright install`.)
- Test target: STAGING ONLY — https://qastaging.pushengage.com/admin
  Creds are already in QAAutomations/.env.example. Never paste secrets into any
  issue/PR/comment. Never test against production app.pushengage.com data.
- Test posture: full functional is approved — you MAY create and send test
  broadcasts/drips on staging. Prefix every artifact you create with "QA-CLEANUP".
- Run regression specs against staging with:
    TEST_ENV=staging npx playwright test <spec-path> --project=chromium
  (the npm test:regression:* scripts default to local — override TEST_ENV.)

PLAN
1. Enumerate open issues by KulvinderGosal (oldest first). Build a tracking table.
2. For each issue, read the report + repro steps and classify:
   (a) automatable — map to a spec under tests/pushengage-regression/ (see the
       area map in QAAutomations/PUSHENGAGE_ISSUE_CLEANUP_RUNBOOK.md), or the
       anthropic-skills:pushengage-qa skill;
   (b) manual/visual — drive staging with Playwright/browser and inspect;
   (c) stale/won't-verify — note why.
3. Verify each on staging. Capture a screenshot + console/network evidence.
   Verdict per issue: FIXED / STILL-BROKEN / INCONCLUSIVE (+ one-line reason).
4. Post NOTHING to issues yet. Present me a status table:
   #, title, area, verdict, evidence, spec/skill used.
5. Give me a PROPOSED CLOSE LIST (the FIXED ones). Wait for my approval.
6. After I approve, close ONLY those, each with a short evidence comment
   (what was tested, on what URL/date, result). End every GitHub comment with
   the Claude Code attribution footer.
   Leave STILL-BROKEN open (add a "still reproduces" comment only if I say so);
   flag INCONCLUSIVE ones to me for a manual decision.

Start with step 1 and show me the enumerated issue table before testing.
```

---

## Notes for the operator

- If the new session reports it also can't reach `awesomemotive/*`, your GitHub
  connection may not grant that org. Reconnect at https://claude.ai/connect-github
  and/or have an org owner install the Claude GitHub App on the repo:
  https://github.com/apps/claude/installations/select_target
- Keep the "propose, then I approve" gate. Closing is reversible but noisy; a
  wrong close on a still-broken bug is the kind of "mess up" we're avoiding.
- LedgerPort cleanup is handled separately (its issues ARE reachable from the
  `kulvindergosal` session, e.g. the 21 open issues in `KulvinderGosal/QAAutomations`).
