// LedgerPort QuickBooks Connector — PR #237 "QuickBooks App Store Silver listing"
// (repo awesomemotive/pushengage-omnysync-backend, branch task/silver-listing).
// 15 test cases (the Asana subtasks SL-T*/SL-S*) that close the gaps an Intuit
// technical (T) + security (S) review would flag before listing on the QB App Store.
// Source: Asana "QA — PR #237: QuickBooks App Store Silver listing (15 test cases)"
// (gid 1218179181761237) + the risk-based test plan authored in this QA pass
// (testpilot-qa-records/PR237-quickbooks-silver-listing-test-plan.md). MANUAL /
// Postman + QBO-sandbox cases — not the Playwright runner (frameworkId null).
import type { TmCase, TmPriority, TmSuite } from "./types";

export const LP_PR237_SUITE_ID = "suite-lp-pr237";
export const LP_PR237_SUITES: TmSuite[] = [
  { id: LP_PR237_SUITE_ID, name: "PR #237 · QuickBooks App-Store Silver listing", parentId: null, productId: "lp-api", order: 40 },
];

const SEED_AT = "2026-09-17T00:00:00.000Z";
type Raw = { key: string; title: string; area: string; priority: TmPriority; step: string; expected: string; description: string };
const RAW: Raw[] = [
  {
    key: "SL-T1-01", title: "Disconnect QuickBooks in-app revokes LedgerPort at Intuit (single business)", area: "T1-revoke", priority: "critical",
    step: "Precondition: exactly ONE staging business connected to the sandbox QB company. 1) In QBO sandbox → My Apps, confirm LedgerPort is connected. 2) Dashboard → business → Disconnect QuickBooks → confirm. 3) Refresh My Apps. Postman alt: DELETE /api/v1/businesses/{businessId}/accounting/{accountingMappingId} → 200.",
    expected: "Dashboard shows QuickBooks disconnected/pending; LedgerPort is no longer listed on My Apps (allow ~1 min); reconnecting shows Intuit's full consent screen (fresh grant).",
    description: "Ref T1 (Intuit 2.3 / OAuth Step 16). ConnectionService.disconnectAccountingMapping calls revokeAccountingTokensIfLastOnRealm BEFORE softDelete blanks credentials → QuickBooksOAuthProvider.revokeTokensAtProvider (intuit-oauth revoke()). Best-effort, logs 'Accounting tokens revoked at provider'. P0 — the path an Intuit reviewer tests.",
  },
  {
    key: "SL-T1-02", title: "Shared QB company: disconnecting one business must not break the other", area: "T1-revoke", priority: "critical",
    step: "Setup: two businesses A & B connected to the SAME sandbox QB company; confirm both sync (Manual Sync one order each). 1) Disconnect QB on A. 2) On B run Manual Sync + open sync settings (account dropdowns load). 3) Check My Apps. 4) Disconnect QB on B; check My Apps again.",
    expected: "After step 1: B still syncs, its account lists load, NO reconnect error on B, LedgerPort still on My Apps. After step 4 (B was last): LedgerPort gone from My Apps. FAIL if B errors right after A disconnects.",
    description: "Ref T1. revokeAccountingTokensIfLastOnRealm → findAllByAccountingCompanyId(accountingCompanyId), filters out the removed mapping; if any remain it logs 'Skipping provider token revocation — accounting company still in use' and does NOT revoke. Intuit revoke kills every grant on the realm, so revoke only when the LAST business disconnects. Riskiest logic in the PR — P0.",
  },
  {
    key: "SL-T1-03", title: "Disconnect still succeeds when Intuit already revoked the grant", area: "T1-revoke", priority: "high",
    step: "1) With a connected business, revoke LedgerPort from the Intuit side first (QBO → My Apps). 2) Dashboard → Disconnect QuickBooks. 3) Reconnect afterwards.",
    expected: "Step 2 completes WITHOUT an error toast (connection shows disconnected/pending); reconnect works. Record which happened: clean 200, OR 'Accounting mapping not found' / button already gone (Intuit-side webhook pre-soft-deleted) — both acceptable, note which.",
    description: "Ref T1. Revocation is best-effort: revokeTokensAtProvider catches provider errors ('token revocation failed at Intuit'); ConnectionService catches anything else ('Failed to revoke tokens at provider, continuing with local disconnect'). Local soft-delete + status update always run. P1.",
  },
  {
    key: "SL-T2-01", title: "Plan limit refused at Connect QuickBooks, BEFORE the Intuit consent screen", area: "T2-planlimit", priority: "high",
    step: "Setup: account on a plan limited to ONE accounting connection; business A connected, business B not. 1) On B click Connect QuickBooks. 2) Postman GET /api/v1/oauth/quickbooks/initiate?businessId=<B>&redirectUrl=…/connections. 3) On A (already connected) click Connect QuickBooks + complete consent. 4) Upgrade plan, retry step 1.",
    expected: "1) Immediate in-app error, you NEVER see Intuit consent. 2) HTTP 403 'Maximum accounting connections (1) reached for your plan. Please upgrade…', NO 302. 3) Reconnect reaches Intuit and completes (count not consulted for an existing mapping). 4) B connects.",
    description: "Ref T2. QuickBooksOAuthProvider.generateAuthorizationUrl: only when findByBusinessId is empty AND planLimitService injected → checks maxAccountingTools; if != -1 and count >= max throws AppError(FORBIDDEN, 403). An existing mapping in any status = reconnect (exempt). P1.",
  },
  {
    key: "SL-T3-01", title: "QuickBooks refresh-token renewal cron renews tokens due within 14 days", area: "T3-cron", priority: "high",
    step: "Developer-paired. Before: every connected business syncs (Manual Sync one order). Dev runs POST /api/internal/cron/token-refresh (internal, OIDC) + shares JSON. After: re-sync all + open Resolution Center. Negative: dev moves one mapping's refreshTokenExpiresAt into the 14-day window + revokes it at Intuit, runs the job twice more.",
    expected: "Response {\"success\":true,\"tokenRefresh\":{\"scanned\":N,\"refreshed\":R,\"failed\":F}} (scanned:0 on a young fleet is normal). After run: all still sync, none flip to error, no new Resolution Center items. Negative: 2nd run failed:1 for that business + it shows 'Reauthorize QuickBooks' (SL-T4-01); 3rd run no longer scans it (not retried forever).",
    description: "Ref T3 (Intuit 2.2). TokenRefreshService selects deletedAt null, status != disconnected, refreshTokenExpiresAt in (now, now+14d) asc; refreshAccessToken each. Permanent invalid_grant → sets refreshTokenExpiresAt=now (drops out of window). New indexed column business_accounting_mappings.refreshTokenExpiresAt (migration 20260826000000). P1.",
  },
  {
    key: "SL-T4-01", title: "Revoked at Intuit: Resolution Center shows critical 'Reauthorize QuickBooks'; reconnect clears it", area: "T4-health", priority: "critical",
    step: "1) Healthy connected business. 2) QBO → My Apps → disconnect LedgerPort. 3) Dashboard → Manual Sync one order (forces a token refresh → now fails). 4) Open Overview → Resolution Center. 5) Postman GET /api/v1/businesses/{businessId}/connections/{connectionId}. 6) Click Reconnect, complete consent, repeat 4-5 + Manual Sync.",
    expected: "3) Sync fails with a reconnect-type message (not a raw dump). 4) Item 'Reauthorize QuickBooks', priority critical, 'QuickBooks token refresh failed. Please reconnect.' + Reconnect button. 5) data.accounting.status='error' + data.accounting.lastError set (NEW fields). 6) status='active', lastError=null, item gone, Manual Sync succeeds. (Intuit webhook may raise the item before step 3 — note it.)",
    description: "Ref T4. AnalyticsService action-required builder returns reauthorize_quickbooks/critical as soon as accountingMapping.status==='error', BEFORE any date reasoning. AccountingInfo gains status+lastError. The old code judged health by dates only → a revoked token looked fine for up to 100 days. P0.",
  },
  {
    key: "SL-S1-01", title: "API responses carry Cache-Control: no-store, no-cache, must-revalidate", area: "S1-cache", priority: "high",
    step: "Postman / DevTools. Check response headers on: POST /api/v1/auth/login, GET /api/v1/me, GET /api/v1/businesses/{id}/connections, the dashboard analytics-overview XHR, an error response (the 404 from SL-S4-01), an embedded-app request. Then GET /api/v1/plans?platform=stripe with NO auth.",
    expected: "Responses 1-6 (incl. the 404) = 'Cache-Control: no-store, no-cache, must-revalidate'; none uses 'private'. The public /plans response = 200 with 'Cache-Control: public, max-age=300' (NOT no-store) and the pricing page still renders.",
    description: "Ref S1 (Intuit: disable caching with no-cache+no-store, not private). noStore.middleware mounted globally after helmet on api-layer AND sync-layer, before routing (so errors carry it). Override: AccountController.getPublicPlans sets public,max-age=300 (later handler wins). P1.",
  },
  {
    key: "SL-S2-01", title: "Credential redaction in logs and Sentry", area: "S2-redaction", priority: "high",
    step: "Developer-paired. Note timestamps. 1) GET /api/v1/oauth/quickbooks/callback?code=QA-FAKE-CODE-12345&realmId=1&state=bogus (expect 4xx). 2) Any authed EP with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.QA-FAKE-PAYLOAD.QA-FAKE-SIGNATURE (401). 3) Embedded flow with a malformed Shopify session token (401). 4) POST /api/v1/auth/login with password QA-Sentinel-P@ss-9 (401).",
    expected: "Your half: none of the error bodies echo the planted values. Dev half: searching Cloud Logging (proj omnysync) + Sentry for those strings returns nothing; the log lines exist showing [REDACTED]. Over-redaction check: realmId=1 still readable, statusCode intact. Storefront customer-lookup logs no longer carry full email / QB customer names.",
    description: "Ref S2. One scrubber (omnysync-modules/logger/implementations/redact.ts) across Winston, expressErrorHandler (also req.query, exact key 'code' as secret), and sentryFilter. Key pattern token|secret|password|authorization|credential|apikey|cookie|refresh; value patterns JWT/Bearer/query-params with a leading word boundary so statusCode= survives. P1.",
  },
  {
    key: "SL-S3-01", title: "Connect QuickBooks from the dashboard (allow-list baseline)", area: "S3-redirect", priority: "critical",
    step: "1) Log in to app-staging.ledgerport.com, open a business with a Shopify connection and no QuickBooks. 2) Click Connect QuickBooks, sign in to the sandbox QB company, click Connect on Intuit's consent.",
    expected: "You reach Intuit's consent (no error page before it); you land back on the dashboard with QuickBooks connected; the return URL has success=true & platform=quickbooks and nothing token-like. FAIL: 400 'redirectUrl is not an allowed redirect destination' → OAUTH_REDIRECT_ALLOWED_ORIGINS missing the dashboard origin — stop, every other S3 case depends on it.",
    description: "Ref S3. Gate: redirectUrl.ts isAllowedRedirectUrl compares parsed origin against env OAUTH_REDIRECT_ALLOWED_ORIGINS (comma-separated origins, http/https only, no credentials, literal * ignored, empty=refuse-all/fail-closed). Applied at initiate + every callback exit. P0 baseline. Staging value must include https://app-staging.ledgerport.com.",
  },
  {
    key: "SL-S3-02", title: "Connect QuickBooks from inside the Shopify admin (embedded app)", area: "S3-redirect", priority: "critical",
    step: "1) Staging Shopify store admin → Apps → LedgerPort. 2) Connection/settings page → Connect QuickBooks. 3) Complete Intuit consent.",
    expected: "You reach consent and return into the embedded app with QuickBooks connected. FAIL: a 400 or blank page before Intuit → https://staging-shopify-app.ledgerport.com is missing from OAUTH_REDIRECT_ALLOWED_ORIGINS. Report immediately.",
    description: "Ref S3. Same gate as SL-S3-01, different origin — the allow-list needs BOTH the dashboard and the Shopify app host. Embedded app calls initiate with a Shopify session token + a redirectUrl on the Shopify host. Env: OAUTH_REDIRECT_ALLOWED_ORIGINS=https://app-staging.ledgerport.com,https://staging-shopify-app.ledgerport.com. P0.",
  },
  {
    key: "SL-S3-03", title: "QuickBooks initiate refuses foreign and lookalike redirect destinations", area: "S3-redirect", priority: "critical",
    step: "Postman with a JWT, redirects OFF. GET /api/v1/oauth/quickbooks/initiate?businessId=&redirectUrl=X for each X: 1) https://evil.example/callback 2) https://app-staging.ledgerport.com.attacker.example/ (host as prefix) 3) https://app-staging.ledgerport.com@attacker.example/ (host as userinfo) 4) http://app-staging.ledgerport.com/ (http not https) 5) javascript:alert(1) 6) /connections (relative). Control: https://app-staging.ledgerport.com/connections.",
    expected: "Cases 1-6 → HTTP 400 'redirectUrl is not an allowed redirect destination', no 302, no Location to Intuit. Control → 302 with Location on appcenter.intuit.com.",
    description: "Ref S3. toOrigin accepts only http/https, rejects username/password, compares url.origin for EQUALITY (no prefix/substring). Case 4 fails because origin includes scheme → http != https. This is the open-redirect defense — P0.",
  },
  {
    key: "SL-S3-04", title: "Shopify connect + login initiate refuse a bad redirectUrl and a bad shop", area: "S3-redirect", priority: "high",
    step: "Postman, redirects OFF. Endpoints: Connect GET /api/v1/oauth/shopify/initiate?businessId=&shop=S&redirectUrl=R (with token); Login GET /api/v1/oauth/shopify/login/initiate?shop=S&redirectUrl=R (no auth). Run each with: good shop + R=https://evil.example/ ; good R + S=evil.example ; good R + S=acme.myshopify.com.evil.example ; good R + S=https://acme.myshopify.com. Control: good shop + R=…/login.",
    expected: "Bad R → 400 'redirectUrl is not an allowed redirect destination'. S=evil.example / lookalike / with-scheme → 400 'shop must be a *.myshopify.com domain'. Control → 302 to https://<shop>/admin/oauth/authorize?…. No case redirects except the control.",
    description: "Ref S3. assertShopDomain uses SHOPIFY_SHOP_DOMAIN_PATTERN=/^[a-zA-Z0-9-]+\\.myshopify\\.com$/; assertAllowedRedirect = same allow-list gate as QuickBooks. Order: required-param → shop domain → redirect allow-list. Callbacks re-check the redirect decoded from the signed state. P1.",
  },
  {
    key: "SL-S3-05", title: "Shopify login lands on /auth/callback with a one-time code; no tokens in the URL", area: "S3-token-url", priority: "critical",
    step: "1) Log out; DevTools → Network → Preserve log. 2) On /login choose Log in with Shopify, enter the staging shop, approve. 3) Watch the redirect chain + final address bar. 4) Stripe test checkout return (shares the path): upgrade a plan → land on /auth/callback?code=… logged in with the plan applied.",
    expected: "Chain ends …/oauth/shopify/login/callback → 302 → /auth/callback?success=true&code=<opaque> → logged in. NO accessToken=/refreshToken=/expiresIn=/tempToken= anywhere in the chain or history (check History, search accessToken). Code works ONCE: POST /api/v1/auth/exchange-code/redeem {\"code\":\"<that>\"} a 2nd time → 4xx, never a fresh token pair. Step 4 still works.",
    description: "Ref S3 (Intuit: endpoints receiving auth tokens in URL params must not return HTML). Login callback → authService.generateExchangeCode(...,'shopify-login') → redirect success=true&code=. Redeem is public+rate-limited, first returns tokens then deletes the code. Strict-IP relaxed for checkout-success + shopify-login (why Stripe return is checked here). P0.",
  },
  {
    key: "SL-S3-06", title: "Shopify login for a 2FA user goes to /login with no token and no code", area: "S3-token-url", priority: "high",
    step: "Setup: a dashboard user with 2FA enabled whose email matches the Shopify shop owner. 1) Log out; Log in with Shopify with that shop; approve.",
    expected: "You land on /login?shopify_error=two_factor_required&shop=<shop>.myshopify.com. The URL has NO tempToken= and NO code=; you are NOT logged in. Normal email+password+2FA login still works. (FE follow-up: /login may not yet render a banner for shopify_error=two_factor_required → file to awesomemotive/pushengage-ledgerport.)",
    description: "Ref S3. When authResult.tokens.tempToken is set, the controller redirects to /login with shopify_error=two_factor_required + shop, and deliberately does NOT mint an exchange code (a temp token is still a token). Removed behaviour: ?success=true&requires2FA=true&tempToken=. P1.",
  },
  {
    key: "SL-S4-01", title: "Removed unauthenticated connection lookups return 404; business-scoped endpoints still work", area: "S4-unauth", priority: "critical",
    step: "Postman. Use a REAL shop domain + businessId (so it proves the routes are gone, not the data). Run each TWICE (no auth, then with token): GET /api/v1/connections/shop/<shop>.myshopify.com ; GET /api/v1/connections/exists/{businessId} ; GET /api/v1/connections/business/{businessId}/platform/shopify. Regression: GET /api/v1/businesses/{businessId}/connections (200 list) ; GET /api/v1/connections/{connectionId}/sync-config (200).",
    expected: "All SIX lookup calls → HTTP 404 (route not found); no body contains companyId, companyName or companyEmail. The two neighbour routes still 200. Dashboard + embedded connection pages load; SL-S3-01 still passes; WooCommerce connect (if available) still works.",
    description: "Ref S4. Three URLs answered without login and returned QB company id/name/email for any guessable shop/business id — now deleted (createConnectionRoutes + mount + 3 controller methods + service methods). Repository methods kept (webhooks use them). Still mounted (authed): …/sync-config, …/lookups, sync-log. P0.",
  },
];

export const LP_PR237_CASES: TmCase[] = RAW.map((r) => ({
  id: `seedcase-lppr237-${r.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  key: r.key,
  title: r.title,
  description: r.description,
  suiteId: LP_PR237_SUITE_ID,
  priority: r.priority,
  automation: "manual",
  steps: [{ step: r.step, expected: r.expected }],
  tags: ["ledgerport", "quickbooks", "pr237", "silver-listing", r.area.toLowerCase().split("-")[0]],
  review: "approved",
  frameworkId: null,
  specFile: null,
  lastRunStatus: "unexecuted",
  lastRunAt: null,
  runs: 0,
  source: "seed",
  createdBy: "Kulvinder Singh",
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
  comments: [],
  history: [],
}));
