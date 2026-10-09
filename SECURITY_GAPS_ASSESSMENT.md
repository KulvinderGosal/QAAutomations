# PushEngage — Security Gaps Assessment

**Prepared for:** PushEngage QA / Engineering
**Author:** QA (Claude Code assist)
**Date:** 2026-10-09
**Deliverable type:** Assessment document (no code changes, no active exploitation performed)
**Classification:** Internal

---

## 1. Executive summary

This document is a **prioritized security gap assessment** for PushEngage, intended to drive
remediation ("so we can fix them"). It covers two surfaces that together make up the product:

1. **The WordPress plugin** (`admin.php?page=pushengage`) — PHP running inside a customer's
   WordPress site, exchanging an API key with the PushEngage backend.
2. **The multi-tenant SaaS dashboard + API** (`app.pushengage.com` / `qastaging.pushengage.com`) —
   where subscribers, campaigns, segments, analytics and API keys live.

**Method & honesty note.** Active/live probing was **not** performed (scope = assessment only; the
sandbox also blocks outbound requests). Findings are derived from (a) the attack surface the QA repo
itself exposes — every route, setting, and flow the ~200 Playwright specs exercise, (b) the product
architecture, and (c) well-established vulnerability classes for WordPress plugins and multi-tenant
SaaS. **Each finding is written as a gap to *verify and fix*, with an explicit "How to confirm"
step** — none are asserted as confirmed live vulnerabilities except where noted as **OBSERVED in this
repo**. Treat P0/P1 items as "verify first, fix if present."

**One gap is already confirmed in this repository** (SEC-REPO-01): real/working-looking credentials
are committed in plaintext.

### Top priorities

| # | Finding | Area | Priority | Status |
|---|---------|------|----------|--------|
| SEC-REPO-01 | Plaintext credentials committed to the QA repo | Secrets hygiene | **P0** | **OBSERVED** |
| SEC-API-01 | Tenant isolation / IDOR on site_id, subscriber_id, campaign_id | SaaS API authz | **P0** | Verify |
| SEC-WP-01 | Missing/weak capability + nonce checks on admin-ajax / REST handlers | WP plugin | **P0** | Verify |
| SEC-AUTH-01 | API key lifecycle: exposure, regeneration, scope, revocation | Auth | **P0** | Verify |
| SEC-INJ-01 | Stored XSS via notification title/body/URL/UTM and segment names | Injection | **P1** | Verify |
| SEC-WP-02 | SQL injection via `$wpdb` on un-prepared queries | WP plugin | **P1** | Verify |
| SEC-INT-01 | SSRF / open-redirect via RSS-auto-push, webhooks, image/icon URL fetch | Integrations | **P1** | Verify |
| SEC-PRIV-01 | Subscriber PII exposure in exports, URLs, logs, analytics filters | Privacy | **P1** | Verify |
| SEC-INFRA-01 | Transport/response security headers, cookie flags, CSP | Infra | **P2** | Verify (live) |

---

## 2. Scope, assumptions, and trust boundaries

### In scope
- PushEngage WordPress plugin admin UI and its server-side handlers
- PushEngage SaaS dashboard + REST/API used by the plugin and dashboard
- Authentication, API-key handling, multi-tenant isolation
- Notification content handling (injection sinks)
- Integrations that fetch or accept external input (RSS auto-push, ecommerce events, webhooks)
- Secrets hygiene in the QA automation repo itself

### Out of scope / not performed
- Active exploitation, auth-bypass attempts, payload injection against live systems
- Load/DoS testing
- Third-party provider internals (FCM/APNs, browser push services)
- Source audit of the plugin PHP (the plugin source is **not** in this repo — see §9)

### Assumptions (label-and-verify)
- A1: The plugin authenticates to the backend with a **site-scoped API key** (the repo has
  `settings-excel/15-validate-api-key` and `16-validate-re-generate-api-key`, plus a
  connect/disconnect-site flow). **Verify the key's scope and transport.**
- A2: The dashboard is **multi-tenant** — many customer sites/apps behind one app. **Verify every
  resource is filtered by the authenticated tenant server-side, not just in the UI.**
- A3: Signup supports **Google OAuth** (`onboarding/10-…register-with-google…`). **Verify OAuth
  state/redirect validation.**
- A4: Notifications accept user-controlled **title, body, URL, image, UTM, buttons** and are rendered
  in the dashboard UI and preview. **Verify output encoding at each sink.**

### Trust boundaries (where to concentrate review)
```
[Browser subscriber] --push--> [Push service] <--API-- [PushEngage backend] <--API key-- [WP plugin on customer site]
        |                                                      ^                                   ^
        |  opt-in JS / service worker                          |  multi-tenant data store          |  wp-admin (capabilities, nonces)
        v                                                      v                                   v
  (XSS in opt-in, SW scope)                     (IDOR / tenant isolation)              (CSRF, authz, SQLi, SSRF, file upload)
```
Every arrow crossing a boundary is an authorization and input-validation checkpoint.

---

## 3. Finding register (detailed)

Each finding: **Gap → Why it matters → How to confirm → Recommended fix → Priority.**

---

### A. Secrets & QA-repo hygiene

#### SEC-REPO-01 — Plaintext credentials committed to the repository (**P0, OBSERVED**)
- **Gap:** Working-looking credentials are committed in cleartext:
  - `.env.example` contains a staging WP username/password and a local admin username/password
    (not placeholders — they are real-looking values, redacted here; see the file for specifics).
  - `manual-broadcast-sender.js` hardcodes the local admin password.
  - Multiple specs hardcode the local admin password (e.g.
    `tests/pushengage-regression/critical/settings-core/01-connect-site.spec.js`,
    and others under `installation/` and `settings-core/`).
- **Why it matters:** Anyone with repo read access (or anyone who finds the repo if it ever leaks)
  gets staging access. Credentials in git history persist even after deletion. If the staging
  password matches or hints at production patterns, blast radius grows.
- **How to confirm:** grep the repo for the known password substrings and for hardcoded `pwd`/`log`
  fills in the specs — already confirmed present in the files listed above.
- **Recommended fix (do now):**
  1. **Rotate** the staging `kgosal` password and the local admin password immediately.
  2. Replace values in `.env.example` with obvious placeholders (`WP_PASSWORD=<set-in-.env>`).
  3. Move real values into `.env` only (already git-ignored — verify `.gitignore` covers `.env`).
  4. Remove hardcoded passwords from `manual-broadcast-sender.js` and all specs; read from
     `process.env` / the config helper instead.
  5. **Purge from git history** (e.g. `git filter-repo`) and force-rotate, since history retains them.
  6. Add a pre-commit secret scanner (gitleaks/trufflehog) and a CI secret-scan gate.
- **Priority:** **P0** (confirmed, trivially exploitable by anyone with repo access).

#### SEC-REPO-02 — No secret scanning / CI gate (**P2**)
- **Gap:** No evidence of `gitleaks`/`trufflehog`/GitHub secret-scanning enforcement; `.github/`
  workflows should be reviewed to ensure secrets never print to CI logs.
- **Fix:** Add secret scanning to pre-commit and CI; fail the build on hits; mask secrets in logs.

---

### B. SaaS dashboard & API — multi-tenant authorization

#### SEC-API-01 — Tenant isolation / IDOR (**P0**)
- **Gap:** Multi-tenant resources (sites/apps, subscribers, segments, campaigns, analytics, API
  keys) are typically addressed by numeric or guessable IDs. If the backend authorizes by
  "is logged in" rather than "owns this specific resource," Customer A can read/modify Customer B's
  data by changing an ID.
- **Why it matters:** This is the single highest-impact SaaS risk (per the skill's Multi-Tenant
  Security Rule): cross-tenant subscriber exposure, sending to another tenant's audience, reading
  another tenant's campaigns/analytics.
- **How to confirm (two accounts, A and B):** For every endpoint that takes a `site_id`,
  `subscriber_id`, `segment_id`, `campaign_id`, `goal_id`, `report_id`, export id, etc.:
  - Authenticate as A, capture a request, swap the ID for one of B's → must return **403/404**, not data.
  - Test read, write, delete, duplicate, and export variants.
  - Test enumeration: sequential IDs, missing IDs, negative/overflow IDs.
- **Recommended fix:** Enforce **ownership checks server-side on every request** (authorize the
  (tenant, resource) pair, not just the session). Prefer **unguessable IDs** (UUIDs) and scope all
  queries with `WHERE tenant_id = :current_tenant`. Add automated IDOR regression tests for each
  resource type.
- **Priority:** **P0**.

#### SEC-API-02 — API authN/authZ, rate limiting, error schema (**P1**)
- **Gap:** The public/plugin API may lack: consistent authentication on every route, authorization
  per operation, rate limiting (brute-force / enumeration / abuse), idempotency on send, and a safe
  error schema (no stack traces / internal IDs leaked).
- **How to confirm:** For each documented endpoint, test: no token, expired token, token for another
  tenant, missing scope, malformed body, oversized body, rapid repeated requests, duplicate send
  (idempotency), and inspect error bodies for leakage. **Do not invent endpoints — use the real API
  docs / the plugin's network calls.**
- **Fix:** Central auth middleware + per-route authz + per-tenant rate limits + generic error schema
  + idempotency keys on campaign send.
- **Priority:** **P1**.

#### SEC-AUTH-01 — API key lifecycle (**P0**)
- **Gap:** The plugin exchanges an **API key** (generate/regenerate flow exists). Risks: key shown in
  full after creation and in page HTML/DOM; key stored in `wp_options` unencrypted and readable by
  any admin-level plugin; key sent over query string (logged); no scoping (one key = full account);
  regeneration does not **immediately revoke** the old key; key visible in browser devtools/network.
- **How to confirm:**
  - Inspect where the key renders (view-source, DOM, network) — is it masked after first reveal?
  - Check transport: header vs query string.
  - Regenerate, then replay an old-key request → must be rejected immediately.
  - Check whether a site-scoped key can call account-wide operations (privilege scope).
- **Fix:** Mask keys after creation; transmit in `Authorization` header only; store encrypted; scope
  keys to a single site with least privilege; revoke-on-regenerate; support multiple named keys with
  independent revocation; audit-log key use.
- **Priority:** **P0**.

#### SEC-AUTH-02 — Session, OAuth, and account security (**P1**)
- **Gap:** OAuth signup (`register with google`) can be vulnerable to **open-redirect / missing
  `state` (CSRF) / account-linking takeover** (linking a Google account to an existing email without
  verification). Session risks: no re-auth for sensitive actions, long-lived sessions, no MFA,
  weak password policy (the committed staging password's pattern suggests policy is lax).
- **How to confirm:** Inspect the OAuth flow for a validated `state` param and an allow-listed
  `redirect_uri`; attempt to link Google to an existing unverified email; check password policy, MFA
  availability, session expiry, and concurrent-session handling.
- **Fix:** Enforce OAuth `state` + redirect allow-list; verify email before account linking; add MFA;
  enforce a strong password policy; short session TTL + re-auth for key/billing/team changes.
- **Priority:** **P1**.

---

### C. WordPress plugin — server-side

> The plugin PHP is not in this repo (see §9). These are the standard WP-plugin vulnerability classes
> to audit; each maps to a concrete code review + test.

#### SEC-WP-01 — Missing capability + nonce checks (CSRF / broken access control) (**P0**)
- **Gap:** WP plugins commonly register `admin_ajax` actions and REST routes. If a handler lacks a
  `current_user_can()` capability check and/or `check_ajax_referer()` / `wp_verify_nonce()`, then:
  - A low-privilege user (e.g. subscriber/author) can invoke admin-only actions (privilege escalation).
  - A CSRF page can trigger state changes (disconnect site, change settings, send a broadcast) while
    an admin is logged in.
- **How to confirm (needs plugin source — see §9):** For every `add_action('wp_ajax_…')`,
  `register_rest_route`, and `admin_post_` handler: confirm it (1) checks a capability appropriate to
  the action and (2) verifies a nonce. REST routes must have a non-trivial `permission_callback`
  (never `__return_true` for state-changing routes).
- **Fix:** Add capability + nonce checks to every handler; set proper `permission_callback`; treat
  "logged in" ≠ "authorized."
- **Priority:** **P0**.

#### SEC-WP-02 — SQL injection via `$wpdb` (**P1**)
- **Gap:** Any custom query built with string concatenation instead of `$wpdb->prepare()` is an SQLi
  sink (subscriber filters, segment conditions, analytics date/filter params are prime candidates).
- **How to confirm:** `grep` plugin source for `$wpdb->query`, `->get_results`, `->get_var` without a
  neighboring `prepare(`; test filter/search params with SQL metacharacters in a safe env.
- **Fix:** Always `$wpdb->prepare()` with placeholders; validate/whitelist column/order-by names.
- **Priority:** **P1**.

#### SEC-WP-03 — Insufficient input sanitization / output escaping (**P1**)
- **Gap:** Settings and notification fields that are stored and later rendered in wp-admin without
  `sanitize_*` on input and `esc_html`/`esc_attr`/`esc_url` on output → **stored XSS in the admin**.
- **How to confirm:** Review each `update_option`/meta save for sanitization and each echo for
  escaping; inject `"><script>` style payloads into settings in a safe env and view the admin page.
- **Fix:** Sanitize on input, escape on output at every sink; use `wp_kses` for rich fields.
- **Priority:** **P1**.

#### SEC-WP-04 — Notification-icon / media upload handling (**P1**)
- **Gap:** The repo has `settings-core/08-upload-notification-icon`. File-upload handlers can allow
  disallowed types (SVG with embedded script, PHP via double extension), missing MIME/size checks, or
  predictable upload paths. SVG icons are a common stored-XSS vector.
- **How to confirm:** Attempt upload of `.svg` with script, `.php`/`.phtml`, oversized files, and
  files with spoofed MIME; check where they are served and with what `Content-Type`.
- **Fix:** Allow-list image types; strip/deny SVG or sanitize it; validate real MIME; randomize
  stored names; serve from a non-executable path with correct `Content-Type` + `X-Content-Type-Options`.
- **Priority:** **P1**.

#### SEC-WP-05 — Plugin lifecycle: activation/deactivation/delete, options autoload, uninstall (**P2**)
- **Gap:** Sensitive data (API key) left in `wp_options` with `autoload=yes` after deactivate/delete;
  no cleanup on uninstall; capabilities/roles added but not removed. The repo exercises
  activate/deactivate/delete (`installation/10–13`) — good hooks to add security assertions.
- **How to confirm:** After deactivate/delete, inspect `wp_options` for leftover secrets; check
  `uninstall.php` / uninstall hook.
- **Fix:** Store secrets with `autoload=no`; wipe secrets on deactivate; full cleanup on uninstall.
- **Priority:** **P2**.

---

### D. Injection & content handling (dashboard + delivered notifications)

#### SEC-INJ-01 — Stored XSS via notification + segment content (**P1**)
- **Gap:** Notification **title, body, URL, image URL, UTM parameters, and multi-action button
  labels/URLs** (the repo has extensive specs for all of these: `campaigns/06–21`), plus **segment
  names, audience-group names, site names** are user-controlled and rendered in the dashboard, the
  preview pane, and analytics tables. Without output encoding at each render sink → stored XSS.
- **Why it matters:** XSS in a multi-tenant dashboard can hijack a session, read another view, or
  pivot (especially combined with weak tenant isolation).
- **How to confirm:** Inject `"><img src=x onerror=alert(1)>` / `javascript:` URLs into each field,
  then view the campaign list, preview, and analytics; also check the `notification click URL` and
  button URL for `javascript:`/`data:` scheme acceptance.
- **Fix:** Context-aware output encoding at every sink; validate URL schemes to `https?:` allow-list;
  strip control chars; apply a CSP (see SEC-INFRA-01) as defense-in-depth.
- **Priority:** **P1**.

#### SEC-INJ-02 — CSV/formula injection in exports (**P2**)
- **Gap:** Subscriber/analytics exports that write user-controlled strings (e.g. a subscriber
  attribute or campaign name beginning with `=`, `+`, `-`, `@`) cause formula execution when opened in
  Excel/Sheets.
- **How to confirm:** Set an attribute/name to `=HYPERLINK(...)` and export; open in a spreadsheet.
- **Fix:** Prefix risky cells with `'` or sanitize leading formula chars on export.
- **Priority:** **P2**.

---

### E. Integrations — SSRF, redirects, webhooks

#### SEC-INT-01 — SSRF / open-redirect via server-side URL fetch (**P1**)
- **Gap:** Features that fetch a server-side URL are SSRF candidates:
  - **RSS Auto-Push** (`campaign/04-rss-auto-push`) — backend fetches an attacker-supplied feed URL.
  - **Notification/opt-in image & icon by URL** — if fetched server-side.
  - Any webhook/callback URL the user can set.
  A malicious URL (`http://169.254.169.254/…`, internal hosts, `file://`) can hit cloud metadata or
  internal services; redirect chains can bypass naive allow-lists.
- **How to confirm:** Point RSS/image/webhook URL at an internal/metadata address and a redirector;
  observe whether the backend connects and what it returns.
- **Fix:** Allow-list schemes (`https` only), resolve and block private/link-local/metadata IP ranges,
  disable redirects or re-validate each hop, set timeouts, and fetch via an egress proxy.
- **Priority:** **P1**.

#### SEC-INT-02 — Ecommerce/webhook event authenticity (**P1**)
- **Gap:** WooCommerce/Shopify/event endpoints that accept purchase/cart events must verify
  **signatures/HMAC** and tenant ownership; otherwise an attacker forges conversions/revenue or
  injects events for another tenant (corrupts analytics & attribution — a P0-class data-integrity
  risk per the skill).
- **How to confirm:** Replay/forge an event without a valid signature, and with another tenant's id.
- **Fix:** Verify provider HMAC/signature; bind events to the authenticated tenant; reject replays
  (nonce/timestamp window).
- **Priority:** **P1**.

---

### F. Subscriber data & privacy

#### SEC-PRIV-01 — PII exposure & data lifecycle (**P1**)
- **Gap:** Subscriber records (endpoint tokens, IP, geo, attributes) may be exposed via: IDOR
  (SEC-API-01), overly broad exports, PII in URLs/logs/referrers, analytics filters that leak other
  tenants' data, or missing data-deletion (GDPR/CCPA) support.
- **How to confirm:** Review export contents and access control; check whether subscriber IDs appear
  in URLs/logs; test the data-deletion/opt-out path end to end.
- **Fix:** Minimize PII; authorize exports per tenant; keep IDs out of URLs/logs; implement
  verifiable deletion + retention policy.
- **Priority:** **P1**.

#### SEC-PRIV-02 — Opt-in JS / service-worker scope (**P2**)
- **Gap:** The subscription opt-in script and service worker run on the customer's domain. Risks:
  SW registered at too-broad a scope, opt-in widget content injectable, or the subscription
  JS served over a path that allows tampering.
- **How to confirm:** Inspect SW scope and the opt-in payload for reflected/stored input.
- **Fix:** Narrow SW scope; encode any dynamic opt-in content; serve over HTTPS with integrity.
- **Priority:** **P2**.

---

### G. Infrastructure / transport (verify live)

#### SEC-INFRA-01 — Security headers, cookies, TLS, CSP (**P2**)
- **Gap (to verify on `qastaging.pushengage.com` and `app.pushengage.com`):**
  - Response headers: `Strict-Transport-Security`, `Content-Security-Policy`,
    `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`,
    `Permissions-Policy`.
  - Session cookies: `Secure`, `HttpOnly`, `SameSite`.
  - TLS: modern protocols only; HTTP→HTTPS redirect; no mixed content.
  - No sensitive data cached; no secrets in query strings.
- **How to confirm (passive, non-destructive):** `curl -sSI <url>` for headers; inspect cookie flags
  in devtools. *(This sandbox blocks the outbound request, so run from your own machine.)*
- **Fix:** Add the missing headers at the edge/app; set cookie flags; enforce HSTS; adopt a strict CSP
  (also mitigates SEC-INJ-01).
- **Priority:** **P2**.

#### SEC-INFRA-02 — Admin surface & information disclosure (**P3**)
- **Gap:** Exposed `/wp-json` user enumeration, `readme.txt` version disclosure, directory listing,
  verbose errors, debug endpoints.
- **Fix:** Disable user enumeration; remove version banners; disable debug in prod; generic errors.
- **Priority:** **P3**.

---

## 4. Verification plan (maps findings → concrete tests)

Because the deliverable is doc-only, no specs were added. When you're ready to automate, these are the
highest-value security regression tests to build (two test accounts A/B required for the IDOR set):

| Suite | Covers | Findings | Layer |
|-------|--------|----------|-------|
| `security/idor` | Swap `site_id`/`subscriber_id`/`campaign_id`/`segment_id`/export id across tenants A↔B | SEC-API-01, SEC-PRIV-01 | API |
| `security/authz` | No/expired/foreign/missing-scope token per endpoint; rate limit; idempotent send | SEC-API-02, SEC-AUTH-01 | API |
| `security/xss` | Inject payloads into title/body/URL/UTM/button/segment-name; assert encoded render | SEC-INJ-01, SEC-WP-03 | UI |
| `security/upload` | SVG-with-script, PHP, oversized, spoofed-MIME icon upload | SEC-WP-04 | UI/API |
| `security/ssrf` | RSS/image/webhook URL → internal/metadata/redirect | SEC-INT-01 | API |
| `security/headers` | Assert security headers + cookie flags on key routes | SEC-INFRA-01 | HTTP |
| `security/api-key` | Reveal masking, transport, revoke-on-regenerate | SEC-AUTH-01 | UI/API |
| (code review) | Capability+nonce on every handler; `$wpdb->prepare`; sanitize/escape | SEC-WP-01/02/03 | PHP review |

> Note: all active tests must run **against staging/local only**, with throwaway data, and must never
> send real broadcasts to real subscribers.

## 5. Remediation priority

1. **Immediately (P0):** SEC-REPO-01 (rotate + purge committed creds), then verify SEC-API-01
   (tenant isolation/IDOR), SEC-WP-01 (capability+nonce), SEC-AUTH-01 (API key lifecycle).
2. **Next (P1):** SEC-INJ-01, SEC-WP-02/03/04, SEC-INT-01/02, SEC-API-02, SEC-AUTH-02, SEC-PRIV-01.
3. **Then (P2/P3):** SEC-INFRA-01/02, SEC-REPO-02, SEC-WP-05, SEC-INJ-02, SEC-PRIV-02.

## 6. Security sign-off gate (per QA skill)

Do not ship a release while any **unresolved critical security issue** remains. A release is
security-eligible only when: no open P0/P1 security finding, tenant-isolation (IDOR) suite passes,
no secrets in the repo/history, and security headers are in place on production.

## 7. What was and wasn't done (transparency)

- ✅ Enumerated the attack surface from the QA repo and product architecture.
- ✅ Confirmed SEC-REPO-01 (committed credentials) directly in the repo.
- ❌ No live/active security testing (scope = assessment; sandbox also blocks outbound requests).
- ❌ No plugin PHP source review (source not present — see §9).
- ❌ No product behavior asserted as fact where undocumented — items are framed as "verify."

## 8. Recommended next steps

- **Rotate the committed staging/local credentials today** and purge them from git history.
- Decide whether you want me to (a) build the `security/*` Playwright + API suites above, and/or
  (b) do a static PHP audit — for that, add the PushEngage **plugin source repo** to this session.

## 9. Note on plugin source

This repository is **test automation only**; the PushEngage plugin's PHP is not present, so SEC-WP-*
findings are code-review checklists rather than confirmed defects. To turn them into confirmed
findings + fixes, add the plugin source repository to the session and request a static security audit.

---
*This assessment is a planning artifact to guide remediation. "Verify" findings require confirmation
in a safe environment before being treated as live vulnerabilities.*
