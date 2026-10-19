# Silver Listing (PR #237) — Remaining QA Test Runbook

QuickBooks App Store "Silver listing" hardening for **LedgerPort**.
Backend PR: `awesomemotive/pushengage-omnysync-backend#237` (branch `task/silver-listing`).
Asana parent: **QA — PR #237: QuickBooks App Store Silver listing (15 test cases)**.

This kit lets you (or the Claude-for-Chrome extension in your logged-in browser)
finish the **pending** cases fast: each entry has the exact browser step, the API
verification command, and the pass criteria.

---

## 0. Why some steps are "browser" and some are "API"

The interactive OAuth cases require your **authenticated Shopify / Intuit browser
session** and pass through **Cloudflare Turnstile (CAPTCHA)** on the dashboard login
and **Intuit MFA** — none of which can be driven headlessly. So the pattern is:

- **You** (browser) do the click-through (connect / revoke / login).
- **The API harness** verifies the resulting backend state deterministically.

The API login endpoint is Turnstile-gated, so **tokens must be copied from a real
browser login** — they can't be minted from the CLI.

---

## 1. Environment facts (staging)

| Thing | Value |
|---|---|
| API base | `https://api-staging.ledgerport.com` |
| Dashboard | `https://app-staging.ledgerport.com` |
| Shopify app host | `https://staging-shopify-app.ledgerport.com` |
| Shopify store | `ledgerport-staging-qa.myshopify.com` |
| Account | `202` — "Silver Listing QA", **Free plan** |
| Business | `210` — "Silver Listing Business" (default) |
| QB accounting mapping | id `101`, realm `9341457877789463`, company **"WordPress LedgerPort e4f7"**, authorized by `kulvinderjatt@gmail.com` |
| Free plan limits | `maxBusinesses:1`, `maxAccountingTools:1`, `maxConnections:1` |

Key API routes used below:
- Connection health: `GET /api/v1/businesses/210` → `accounting[].status` + `accounting[].lastError` *(both new in this PR)*
- Resolution Center: `GET /api/v1/analytics/overview` → `data.actionsRequired[]`, `actionsRequiredCount`
- Disconnect (accounting): `DELETE /api/v1/businesses/210/accounting/{mappingId}`
- QB initiate: `GET /api/v1/oauth/quickbooks/initiate?businessId=&redirectUrl=`
- Exchange-code redeem: `POST /api/v1/auth/exchange-code/redeem  {"code":"…"}`
- Refresh: `POST /api/v1/auth/refresh  {"refreshToken":"…"}` *(refresh token is single-use / rotates)*

---

## 2. Load the harness

```bash
cd silver-listing-qa

# From a browser login to app-staging, copy the tokens (login response JSON, or
# DevTools > Application > Local Storage). Then:
export LP_ACCESS='eyJ...'      # accessToken  — ~15 min life
export LP_REFRESH='eyJ...'     # refreshToken — single-use, auto-rotated by the harness
source ./lp-api.sh
```

Sanity check (should print the live accounting mapping + an empty Resolution Center):

```bash
sl_status
```

When the access token lapses, the harness auto-refreshes on the next call; if the
refresh token is also spent, just re-`export LP_ACCESS=… LP_REFRESH=…` and `source` again.

---

## 3. Status of all 15 cases

| Case | P | Status | Where |
|---|---|---|---|
| SL-S3-01 QB connect baseline | P0 | ✅ done | API gate re-verified this session |
| SL-S3-02 embedded connect (allow-list) | P0 | ⚠️ **API gate ✅**, UI fresh-connect pending | §4.7 |
| SL-S3-03 QB initiate rejects foreign/lookalike | P0 | ✅ done | re-verified (`sl_redirect_matrix`) |
| SL-S3-04 Shopify connect/login bad redirect+shop | P0 | ✅ done | — |
| SL-S3-05 Shopify login → `/auth/callback?code=` | P0 | ⏳ pending | §4.5 |
| SL-S3-06 2FA Shopify login → `/login`, no token | P1 | ⏳ pending | §4.6 |
| SL-S1-01 Cache-Control no-store | P1 | ✅ done | re-verified (`sl_s1_headers`) |
| SL-S4-01 removed lookups → 404 | P0 | ✅ done | re-verified (`sl_s4_removed`) |
| SL-S2-01 credential redaction (logs/Sentry) | P1 | ⛔ dev-paired | §4.8 |
| SL-T1-01 disconnect revokes at Intuit | P0 | ✅ done | — |
| SL-T1-02 shared QB company disconnect | P0 | ⛔ fixture (needs 2 businesses) | §4.3 |
| SL-T1-03 disconnect after Intuit already revoked | P1 | ⏳ needs Intuit revoke | §4.2 |
| SL-T2-01 plan-limit refused at Connect | P1 | ⚠️ allowed-path ✅, 403 needs fixture | §4.4 |
| SL-T3-01 refresh-token renewal cron | P1 | ⛔ dev-paired | §4.9 |
| SL-T4-01 revoked at Intuit → Resolution Center | P0 | ⏳ needs Intuit revoke | §4.1 |

---

## 4. Test scripts (pending / partial cases)

### 4.1  SL-T4-01 — Revoked at Intuit → critical "Reauthorize QuickBooks"  (P0)

**Proves:** a token revoked at Intuit is reported as a real broken state (`status:error`
+ `lastError`) and surfaces a critical Resolution-Center item with a Reconnect action.

**Prereq:** business 210 has a **healthy** QB mapping. Confirm with `sl_status`
(status `active`). If not connected, run `sl_qb_initiate 210`, open the printed URL in
your Intuit browser, approve.

**Step 1 — revoke at Intuit (browser).** Sandbox has a documented quirk: the app-list
"disconnect" often does **not** revoke tokens. Use a route that truly revokes:
- **Preferred (deterministic):** have a developer call Intuit's OAuth2 **revoke**
  endpoint for mapping 101's refresh token (server-side, with the app client secret), **or**
- reset the sandbox company so the next refresh fails, **or**
- request a one-off sandbox disconnect link from Intuit support.

**Step 2 — force a token refresh (browser).** In the dashboard, run **Manual Sync** on
the business (Overview → Sync). The Intuit-side revoke may also fire a webhook that flips
the state on its own — either is fine.

**Step 3 — verify (API):**
```bash
sl_t4_verify        # expects accounting[0].status = "error" + lastError set,
                    # and a critical item type=reauthorize_quickbooks in actionsRequired
```
**PASS:** `accounting[0].status == "error"`, `lastError` = *"QuickBooks token refresh
failed. Please reconnect."* (or equivalent). Confirmed against PR #237
`apps/analytics-service/services/AnalyticsService.ts` (`checkQuickBooksTokenExpiry`), the
`actionsRequired` item is exactly:
```json
{ "type":"reauthorize_quickbooks", "priority":"critical", "title":"Reauthorize QuickBooks",
  "actionLabel":"Reconnect", "description": "<lastError, or '…needs to be reauthorized to continue syncing.'>" }
```

> ⚠️ **Setup nuance (verified in code):** `computeActionsRequired` iterates the business's
> **storefront connections** and reads `conn.accountingMapping`. In this session,
> `analytics/overview` returned `actionsRequired: []` / `platforms: {}` while QB was active
> **because business 210 has zero storefront connections** — a standalone QB mapping with no
> Shopify/Woo connection row is not iterated, so the reauth item may not surface via
> `analytics/overview` even when `status:'error'`. Two consequences:
> 1. **Primary evidence** = `sl_status`'s `accounting[0].status/lastError` (these are populated
>    directly from the mapping, independent of storefront connections).
> 2. To exercise the **Resolution Center** path too, connect a **Shopify/Woo storefront**
>    to business 210 first (so the QB mapping is attached to a connection row), then revoke.
>    Otherwise verify the reauth item on a business that has a full storefront+QB connection.
>
> Also note (code): the same critical "Reauthorize QuickBooks" item is emitted on **date**
> grounds — `refreshTokenExpiresAt < now` ("has expired") or access-token-expired-with-no-refresh
> ("Session expired") — and a **high** "QuickBooks Connection Expiring" within 7 days of refresh expiry.

**Step 4 — clear it (browser + API).** Click **Reconnect** in the dashboard (or
`sl_qb_initiate 210` → open URL → approve), then:
```bash
sl_t4_clear_verify  # expects status="active", lastError=null, actionsRequired=[]
```

**Report:** paste both `sl_t4_verify` and `sl_t4_clear_verify` outputs; note whether the
error state appeared via the webhook or via Manual Sync.

---

### 4.2  SL-T1-03 — Disconnect still succeeds when Intuit already revoked  (P1)

**Proves:** revocation is best-effort; if Intuit already revoked (or is unreachable),
the merchant can still disconnect locally.

**Step 1 (browser):** revoke at Intuit first (as in §4.1 Step 1) on a connected business 210.
**Step 2 (API):**
```bash
sl_t1_03_disconnect 101      # DELETE /businesses/210/accounting/101
```
**PASS:** **HTTP 200** (`"QuickBooks disconnected from business"`) **OR** **HTTP 404**
(`"Accounting mapping not found"` — the Intuit-side disconnect webhook already soft-deleted
it). Both are acceptable; **record which one** you got.
**Step 3 (browser):** reconnect (`sl_qb_initiate 210` → open URL → approve) and confirm it works.

---

### 4.3  SL-T1-02 — Shared QB company: disconnect one business must not break the other  (P0)  ⛔ fixture

**Blocked here:** needs **two businesses connected to the same QB company**. Account 202
is Free (`maxBusinesses:1`) — a second business can't exist.
**To run:** on a plan with `maxBusinesses ≥ 2`, connect business A **and** business B to the
same sandbox company, then disconnect A and confirm B still syncs.
- Verify (API) after: `GET /businesses/{A}` accounting removed; `GET /businesses/{B}`
  accounting still `active`; and (Intuit side) LedgerPort still authorized for the shared
  company because another business holds it (revocation is deliberately skipped when shared).

---

### 4.4  SL-T2-01 — Plan limit refused at Connect QuickBooks  (P1)  ⚠️ allowed-path verified

**Verified this session:** initiate for an **under-limit** business → `200` with the Intuit
`authorizationUrl` (plan check runs at initiate, *before* Intuit). Free plan values confirmed
(`maxAccountingTools:1`).

**Still needs a fixture for the 403:** a business with **no** accounting mapping on an account
already **at** its accounting-tool limit. Requires a plan with `maxBusinesses ≥ 2` and
`maxAccountingTools = 1` (ask Himshikhar which staging plan), with business A already connected.
```bash
# Under-limit business (expect 200 + authorizationUrl):
sl_t2_initiate <businessUnderLimit>
# At-limit business B (expect 403, NO 302):
sl_t2_initiate <businessB_atLimit>
```
**PASS (403 path):** HTTP **403**, message *"Maximum accounting connections (1) reached for
your plan. Please upgrade…"*, and **no** authorizationUrl. Reconnect on the already-connected
business A must still return `200` (existing mapping ⇒ reconnect, count not consulted).

---

### 4.5  SL-S3-05 — Shopify login lands on `/auth/callback?code=`, no tokens in URL  (P0)

**Proves:** Shopify login returns a single-use **code** (not tokens) in the URL.

**Step 1 (browser, ~2 min):**
1. Log out of the dashboard. DevTools → **Network**, tick **Preserve log**.
2. `https://app-staging.ledgerport.com/login` → **Log in with Shopify** → shop
   `ledgerport-staging-qa.myshopify.com` → approve.
3. Watch the redirect chain + final address bar. Then History (**Ctrl/Cmd+Y**), search `accessToken`.

**PASS (eyeball):**
- Chain ends `api-staging/oauth/shopify/login/callback` → `302` →
  `app-staging.ledgerport.com/auth/callback?success=true&code=<opaque>` → logged in.
- **No** URL in the chain or history contains `accessToken=`, `refreshToken=`, `expiresIn=`, `tempToken=`.
- You land in the shop's business/account (not `?success=false&error=account_not_found`).

**Step 2 — verify single-use (API).** Copy the `code` from the `/auth/callback` URL, then:
```bash
sl_s3_redeem <code>
```
**PASS:** HTTP **401** *"Invalid or expired exchange code"*, **no** `accessToken`/`refreshToken`
in the body (the frontend already redeemed it once → second redeem fails).
*(Baselines already confirmed: malformed code → 400 validation; unknown 64-hex → 401, no tokens.)*

**Also check (Stripe path shares this code flow):** do a Stripe **test** checkout upgrade and
confirm you return to `/auth/callback?code=…` and end up logged in with the plan applied.

**Frontend follow-up:** the old `auth-shopify-callback` page is unused; `/auth/callback` must
redeem `?code=` (it already does for the Stripe return).

---

### 4.6  SL-S3-06 — 2FA Shopify login → `/login`, no token and no code  (P1)

**Prereq:** a dashboard user with **2FA enabled** whose email matches the Shopify shop owner.

**Step (browser):** log out → **Log in with Shopify** with that shop → approve.

**PASS:**
- Lands on `https://app-staging.ledgerport.com/login?shopify_error=two_factor_required&shop=<shop>.myshopify.com`.
- URL has **no** `tempToken=` and **no** `code=`; you are **not** logged in.
- Normal email + password + 2FA login still works.

**Frontend follow-up:** the login page may not yet render a message for
`shopify_error=two_factor_required`. If nothing shows, file it in
`awesomemotive/pushengage-ledgerport`.

---

### 4.7  SL-S3-02 — Connect QuickBooks from inside the Shopify admin (embedded)  (P0)  ⚠️ API gate verified

**Verified this session (API):** QB initiate with `redirectUrl` on the Shopify-app origin
`https://staging-shopify-app.ledgerport.com` → **200** with the Intuit authorizationUrl —
i.e. that origin **is** on `OAUTH_REDIRECT_ALLOWED_ORIGINS` (else it would 400). Re-run:
```bash
sl_redirect_matrix 210   # dashboard + shopify-app => 200; foreign/lookalike => 400
```
**Still pending — fresh embedded UI connect (browser):**
1. Shopify admin (`admin.shopify.com/store/ledgerport-staging-qa`) → **Apps → LedgerPort**.
2. Connection/Settings page → **Connect QuickBooks** → complete Intuit consent.

**PASS:** you reach Intuit consent and return into the embedded app with QuickBooks connected.
**FAIL:** a 400 / blank page **before** Intuit ⇒ Shopify-app origin missing from
`OAUTH_REDIRECT_ALLOWED_ORIGINS` (report immediately). *(Note: a fresh connect needs the
business disconnected first; that tears down the shared sandbox connection used elsewhere.)*

---

### 4.8  SL-S2-01 — Credential redaction in logs & Sentry  (P1)  ⛔ dev-paired

**With a developer:** trigger a QB token refresh + a forced error, then grep the service logs
and Sentry for the access/refresh token values and any `Authorization: Bearer` — they must be
redacted (e.g. `[REDACTED]`), never printed. Confirm tokens never appear in URLs, error
reports, or breadcrumbs.

---

### 4.9  SL-T3-01 — QuickBooks refresh-token renewal cron  (P1)  ⛔ dev-paired

**With a developer:** confirm the Cloud Scheduler job exists and the migration ran, then run
the internal cron against a long-idle connection whose refresh token nears expiry; verify the
refresh token is renewed **before** expiry and `refreshTokenExpiresAt` advances. Verify via API
that the mapping stays `active` afterward (`sl_status`).

---

## 5. Regression re-checks (token-free or single-token, all currently ✅)

```bash
sl_s4_removed        # SL-S4-01: 3 removed lookups => 404 (auth + no-auth); kept route => 200
sl_s1_headers        # SL-S1-01: Cache-Control: no-store, no-cache, must-revalidate
sl_redirect_matrix   # SL-S3-01/02/03: allow-list (dashboard+shopify-app => 200; foreign/lookalike => 400)
```

---

## 6. Reporting (per Asana ticket)

- Mark a subtask complete only when it passes; for a failure, comment on the **subtask** with
  the exact URL, what you did, HTTP status + response body (**mask tokens**), and a screenshot.
- **Backend** bugs → Himshikhar directly (not GitHub).
- **Frontend** bugs → `awesomemotive/pushengage-ledgerport`.
- Known follow-ups already expected: login page has no banner for
  `shopify_error=two_factor_required`; `auth-shopify-callback` page is now unused; the Shopify
  app's vendored Postman collection still lists the three deleted endpoints.
